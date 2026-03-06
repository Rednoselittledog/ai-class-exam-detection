#!/usr/bin/env python3
"""
OMR Detection using YOLO
Detects a, b, c, d, double, null bubbles and sorts them by position
"""

import sys
import json
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from ultralytics import YOLO
import os

# Class mapping from YOLO model
CLASS_MAPPING = {
    0: 'a',
    1: 'b',
    2: 'c',
    3: 'd',
    4: 'double',
    5: 'null'
}

def load_model():
    """Load YOLO model"""
    model_path = os.path.join(os.path.dirname(__file__), 'OMR', 'best.pt')
    return YOLO(model_path)

def preprocess_image(image):
    """
    Preprocess image: convert to grayscale and increase contrast

    Args:
        image: PIL Image

    Returns:
        Preprocessed PIL Image
    """
    # Convert to grayscale
    image = image.convert('L')

    # Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)  # Increase contrast by 2x

    # Convert back to RGB for YOLO (YOLO expects 3-channel input)
    image = image.convert('RGB')

    return image

def detect_bubbles(image_base64):
    """
    Detect OMR bubbles from base64 image

    Returns:
        List of detections: [{'class': 'a', 'bbox': [x1, y1, x2, y2], 'conf': 0.95}, ...]
    """
    # Decode base64 image
    image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
    image = Image.open(BytesIO(image_data))

    # Preprocess: grayscale + contrast enhancement
    image = preprocess_image(image)

    # Load model and predict
    model = load_model()
    results = model.predict(source=image, conf=0.4, iou=0.1, verbose=False, augment=True)

    # Extract detections
    detections = []
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            if cls_id in CLASS_MAPPING:
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()

                detections.append({
                    'class': CLASS_MAPPING[cls_id],
                    'bbox': xyxy,  # [x1, y1, x2, y2]
                    'conf': conf
                })

    return detections

def sort_detections_to_answers(detections, img_width):
    """
    Sort detections into answer array based on position

    Algorithm:
    1. Group by columns (left-to-right)
    2. Within each column, sort top-to-bottom
    3. Combine columns in order

    Args:
        detections: List of detection dicts
        img_width: Image width for column detection

    Returns:
        Tuple: (answers, sorted_detections)
        - answers: List of answers in order: ['a', 'b', 'double', 'c', ...]
        - sorted_detections: List of detection dicts in sorted order
    """
    if not detections:
        return [], []

    # Calculate center x for each detection
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        det['center_x'] = (x1 + x2) / 2
        det['center_y'] = (y1 + y2) / 2

    # Sort by x first to group columns
    detections.sort(key=lambda d: d['center_x'])

    # Detect columns by clustering x positions
    # Two boxes in different columns should have non-overlapping x ranges
    columns = []
    current_column = []
    avg_x_min = None
    avg_x_max = None

    for det in detections:
        x1, _, x2, _ = det['bbox']

        if not current_column:
            # Start first column
            current_column.append(det)
            avg_x_min = x1
            avg_x_max = x2
        else:
            # Check if this box overlaps with current column's x range
            # Use average x of current column
            col_avg_x = sum(d['center_x'] for d in current_column) / len(current_column)

            # If x1 of new box > average x of column, it's likely new column
            # Allow some tolerance (e.g., 30% of avg box width)
            avg_width = sum((d['bbox'][2] - d['bbox'][0]) for d in current_column) / len(current_column)
            threshold = col_avg_x + avg_width * 0.5

            if x1 > threshold:
                # New column detected
                columns.append(current_column)
                current_column = [det]
                avg_x_min = x1
                avg_x_max = x2
            else:
                # Same column
                current_column.append(det)

    # Don't forget the last column
    if current_column:
        columns.append(current_column)

    # Sort each column by y (top to bottom) and collect results
    answers = []
    sorted_detections = []
    for column in columns:
        column.sort(key=lambda d: d['center_y'])
        for det in column:
            answers.append(det['class'])
            sorted_detections.append(det)

    return answers, sorted_detections

def draw_detections_on_image(image_base64, detections):
    """
    Draw bounding boxes and labels on image

    Returns:
        Base64 encoded image with detections drawn
    """
    # Decode base64 image
    image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
    image = Image.open(BytesIO(image_data)).convert('RGB')

    # Create drawing context
    draw = ImageDraw.Draw(image)

    # Define colors for each class
    colors = {
        'a': '#3b82f6',  # blue
        'b': '#10b981',  # green
        'c': '#f59e0b',  # yellow
        'd': '#ef4444',  # red
        'double': '#8b5cf6',  # purple
        'null': '#6b7280'   # gray
    }

    # Draw each detection
    for i, det in enumerate(detections):
        x1, y1, x2, y2 = det['bbox']
        cls = det['class']
        conf = det['conf']

        # Get color
        color = colors.get(cls, '#ffffff')

        # Draw rectangle (thicker line)
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

        # Draw label background
        label = f"{cls} ({conf:.2f})"

        # Use default font (PIL builtin)
        try:
            # Try to use a better font if available
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        except:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox = draw.textbbox((x1, y1), label, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Draw label background
        draw.rectangle([x1, y1 - text_height - 4, x1 + text_width + 8, y1], fill=color)

        # Draw text
        draw.text((x1 + 4, y1 - text_height - 2), label, fill='white', font=font)

    # Convert back to base64
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    return f"data:image/png;base64,{img_base64}"

def main():
    """
    CLI interface
    Usage: python omr_detect.py (reads base64 image from stdin)
    Output: JSON with {success, answers, detections}
    """
    try:
        # Read from stdin instead of command line argument to avoid E2BIG error
        image_base64 = sys.stdin.read().strip()

        if not image_base64:
            print(json.dumps({'success': False, 'error': 'No image provided'}))
            sys.exit(1)

        # Detect bubbles
        detections = detect_bubbles(image_base64)

        # Get image dimensions for column detection
        image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        image = Image.open(BytesIO(image_data))
        img_width = image.width

        # Sort into answer array
        answers, sorted_detections = sort_detections_to_answers(detections, img_width)

        # Draw detections on image (use original detections for drawing all boxes)
        annotated_image = draw_detections_on_image(image_base64, detections)

        result = {
            'success': True,
            'answers': answers,
            'detections': sorted_detections,  # ส่ง sorted detections กลับไป
            'total_detected': len(sorted_detections),
            'annotated_image': annotated_image
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
