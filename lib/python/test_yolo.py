#!/usr/bin/env python3
"""Test YOLO OMR model to understand output format"""

from ultralytics import YOLO
import sys
import os

# Load model
model_path = os.path.join(os.path.dirname(__file__), 'OMR', 'best_mapped.pt')
model = YOLO(model_path)

# Print model info
print("=" * 50)
print("YOLO Model Info:")
print("=" * 50)
print(f"Model path: {model_path}")
print(f"Model names (classes): {model.names}")
print(f"Number of classes: {len(model.names)}")
print("=" * 50)

# If you want to test with an image, uncomment:
# results = model.predict(source='test_image.jpg', conf=0.25)
# for result in results:
#     print(f"Boxes: {result.boxes}")
#     for box in result.boxes:
#         cls = int(box.cls[0])
#         conf = float(box.conf[0])
#         xyxy = box.xyxy[0].tolist()
#         print(f"Class: {model.names[cls]} ({cls}), Conf: {conf:.2f}, BBox: {xyxy}")
