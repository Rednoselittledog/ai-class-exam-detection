#!/usr/bin/env python3
"""
Image Cropping Utility
Ported from OMRChecker's CropPage.py
Detects and crops paper boundary from exam sheet images
"""

import sys
import json
import base64
import cv2
import numpy as np
from io import BytesIO
from PIL import Image

# Constants (from OMRChecker)
MAX_COSINE_THRESHOLD = 0.6  # Relaxed from 0.35 to handle slightly distorted rectangles
MIN_PAGE_AREA_THRESHOLD = 80000
APPROX_POLY_EPSILON_FACTOR = 0.025
DEFAULT_GAUSSIAN_BLUR_KERNEL = (3, 3)
PAGE_THRESHOLD_VALUE = 200
PAGE_THRESHOLD_MAX = 255
MORPH_KERNEL_SIZE = (10, 10)


def normalize(image):
    """Normalize image to 0-255 range"""
    return cv2.normalize(image, None, 0, 255, norm_type=cv2.NORM_MINMAX)


def angle(p1, p2, p0):
    """Calculate angle (cosine) between three points"""
    dx1 = float(p1[0] - p0[0])
    dy1 = float(p1[1] - p0[1])
    dx2 = float(p2[0] - p0[0])
    dy2 = float(p2[1] - p0[1])
    return (dx1 * dx2 + dy1 * dy2) / np.sqrt(
        (dx1 * dx1 + dy1 * dy1) * (dx2 * dx2 + dy2 * dy2) + 1e-10
    )


def check_max_cosine(approx):
    """Check if quadrilateral is a rectangle"""
    import sys
    max_cosine = 0
    cosines = []
    for i in range(2, 5):
        cosine = abs(angle(approx[i % 4], approx[i - 2], approx[i - 1]))
        cosines.append(cosine)
        max_cosine = max(cosine, max_cosine)

    result = max_cosine < MAX_COSINE_THRESHOLD
    print(f"[DEBUG]     cosines={[f'{c:.3f}' for c in cosines]}, max={max_cosine:.3f}, threshold={MAX_COSINE_THRESHOLD}, valid={result}", file=sys.stderr)
    return result


def validate_rect(approx):
    """Validate if contour is a valid rectangle"""
    import sys
    is_quad = len(approx) == 4
    print(f"[DEBUG]     vertices={len(approx)}, is_quad={is_quad}", file=sys.stderr)
    if not is_quad:
        return False
    return check_max_cosine(approx.reshape(4, 2))


def order_points(pts):
    """
    Order points in clockwise order:
    top-left, top-right, bottom-right, bottom-left
    """
    rect = np.zeros((4, 2), dtype="float32")

    # Sum and diff to find corners
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    rect[0] = pts[np.argmin(s)]      # top-left
    rect[2] = pts[np.argmax(s)]      # bottom-right
    rect[1] = pts[np.argmin(diff)]   # top-right
    rect[3] = pts[np.argmax(diff)]   # bottom-left

    return rect


def four_point_transform(image, pts):
    """Apply perspective transform to get bird's eye view"""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate width
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # Calculate height
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # Destination points
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    # Compute perspective transform matrix and apply it
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped


def find_page(image):
    """Find page corners in image"""
    import sys

    print(f"[DEBUG] Image shape: {image.shape}", file=sys.stderr)
    print(f"[DEBUG] Image dtype: {image.dtype}", file=sys.stderr)

    # Normalize and blur
    image = normalize(image)
    image = cv2.GaussianBlur(image, DEFAULT_GAUSSIAN_BLUR_KERNEL, 0)
    image = normalize(image)
    print(f"[DEBUG] After blur and normalize", file=sys.stderr)

    # Threshold
    _, image = cv2.threshold(
        image,
        PAGE_THRESHOLD_VALUE,
        PAGE_THRESHOLD_MAX,
        cv2.THRESH_TRUNC
    )
    image = normalize(image)
    print(f"[DEBUG] After threshold", file=sys.stderr)

    # Morphological closing to fill small holes
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, MORPH_KERNEL_SIZE)
    image = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)
    print(f"[DEBUG] After morphology", file=sys.stderr)

    # Canny edge detection (OMRChecker uses inverted thresholds)
    edges = cv2.Canny(image, 185, 55)
    print(f"[DEBUG] After Canny edge detection", file=sys.stderr)

    # Find contours
    contours, _ = cv2.findContours(
        edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )
    print(f"[DEBUG] Found {len(contours)} contours", file=sys.stderr)

    # Apply convexHull to resolve disordered curves due to noise
    contours = [cv2.convexHull(c) for c in contours]
    print(f"[DEBUG] Applied convexHull to contours", file=sys.stderr)

    # Sort contours by area (largest first)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    # Log top 5 contour areas
    print(f"[DEBUG] Top 5 contour areas:", file=sys.stderr)
    for i, contour in enumerate(contours[:5]):
        area = cv2.contourArea(contour)
        print(f"[DEBUG]   #{i+1}: area={area:.0f} (threshold={MIN_PAGE_AREA_THRESHOLD})", file=sys.stderr)

    # Calculate image area for comparison
    image_area = image.shape[0] * image.shape[1]
    print(f"[DEBUG] Image area: {image_area}", file=sys.stderr)

    # Find the page contour - prefer the one closest to image size
    page_contour = None
    best_area_ratio = 0

    for idx, contour in enumerate(contours[:10]):  # Check top 10 contours
        area = cv2.contourArea(contour)

        # Skip small contours (must be larger than MIN_PAGE_AREA_THRESHOLD)
        if area < MIN_PAGE_AREA_THRESHOLD:
            print(f"[DEBUG] Contour #{idx+1}: SKIPPED (area={area:.0f} < {MIN_PAGE_AREA_THRESHOLD})", file=sys.stderr)
            continue

        # Calculate area ratio (how much of the image this contour covers)
        area_ratio = area / image_area
        print(f"[DEBUG] Contour #{idx+1}: area={area:.0f}, ratio={area_ratio:.2%}", file=sys.stderr)

        # Try multiple epsilon values to get 4 vertices
        peri = cv2.arcLength(contour, True)
        epsilon_factors = [APPROX_POLY_EPSILON_FACTOR, 0.03, 0.035, 0.04, 0.045, 0.05, 0.02, 0.015]

        for epsilon_factor in epsilon_factors:
            approx = cv2.approxPolyDP(contour, epsilon_factor * peri, True)
            print(f"[DEBUG]   Trying epsilon={epsilon_factor}: vertices={len(approx)}", file=sys.stderr)

            # Check if it's a rectangle
            if validate_rect(approx):
                print(f"[DEBUG] Contour #{idx+1}: VALID RECTANGLE with epsilon={epsilon_factor}! ✓", file=sys.stderr)

                # Prefer contours that cover more of the image (likely the full page)
                # Only accept if area ratio > 0.15 (covers at least 15% of image)
                if area_ratio > 0.15 and area_ratio > best_area_ratio:
                    page_contour = approx.reshape(4, 2)
                    best_area_ratio = area_ratio
                    print(f"[DEBUG]   => Accepted as best candidate (ratio={area_ratio:.2%})", file=sys.stderr)
                elif area_ratio <= 0.15:
                    print(f"[DEBUG]   => Rejected: too small (ratio={area_ratio:.2%} < 15%)", file=sys.stderr)
                break

        print(f"[DEBUG] Contour #{idx+1}: Done processing", file=sys.stderr)

    if page_contour is None:
        print(f"[DEBUG] No valid page contour found", file=sys.stderr)
        return None

    print(f"[DEBUG] Page contour found: {page_contour.tolist()}", file=sys.stderr)
    return page_contour


def crop_page(image_data):
    """
    Main function to crop page from image

    Args:
        image_data: Base64 encoded image string or file path

    Returns:
        dict with success status, cropped image (base64), and corners
    """
    import sys
    try:
        print(f"[DEBUG] ===== Starting crop_page =====", file=sys.stderr)

        # Decode base64 image
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Remove data URL prefix
            image_data = image_data.split(',')[1]
            print(f"[DEBUG] Removed data URL prefix", file=sys.stderr)

        # Decode base64
        image_bytes = base64.b64decode(image_data)
        print(f"[DEBUG] Decoded base64, size: {len(image_bytes)} bytes", file=sys.stderr)

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        if image is None:
            print(f"[DEBUG] Failed to decode image", file=sys.stderr)
            return {
                'success': False,
                'error': 'Failed to decode image'
            }

        print(f"[DEBUG] Image decoded successfully: {image.shape}", file=sys.stderr)

        # Find page corners
        corners = find_page(image)

        if corners is None:
            print(f"[DEBUG] Page boundary not found", file=sys.stderr)
            return {
                'success': False,
                'error': 'Page boundary not found. Make sure the entire page is visible.'
            }

        # Apply perspective transform
        cropped = four_point_transform(image, corners)

        # Convert back to base64
        _, buffer = cv2.imencode('.png', cropped)
        cropped_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            'success': True,
            'croppedImage': f'data:image/png;base64,{cropped_base64}',
            'corners': corners.tolist(),
            'dimensions': {
                'width': cropped.shape[1],
                'height': cropped.shape[0]
            }
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No image data provided'
        }))
        sys.exit(1)

    # Get base64 image from argument
    image_data = sys.argv[1]

    # Process image
    result = crop_page(image_data)

    # Output JSON result
    print(json.dumps(result))


if __name__ == '__main__':
    main()
