#!/usr/bin/env python3
"""
API Wrapper for omr_croppage_standalone
รับ base64 image → ครอป → ส่งกลับ base64 image
เข้ากันได้กับ API เดิมของ crop_page.py
"""

import sys
import json
import base64
import cv2
import numpy as np

# Import จาก omr_croppage_standalone
from omr_croppage_standalone import crop_document


def crop_page_api(image_data):
    """
    Crop page from base64 image

    Args:
        image_data: Base64 encoded image string (with or without data URL prefix)

    Returns:
        dict with success status, cropped image (base64), and corners
    """
    try:
        # Remove data URL prefix if present
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        # Decode base64 to image
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return {
                'success': False,
                'error': 'Failed to decode image'
            }

        # Crop document using omr_croppage_standalone
        # ใช้ min_area_ratio=0.1 (10%) เป็นค่า default
        cropped, corners = crop_document(
            image,
            min_area_ratio=0.1,
            return_corners=True
        )

        if cropped is None:
            return {
                'success': False,
                'error': 'Page boundary not found. Make sure the entire page is visible.'
            }

        # Convert cropped image back to base64
        _, buffer = cv2.imencode('.png', cropped)
        cropped_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            'success': True,
            'croppedImage': f'data:image/png;base64,{cropped_base64}',
            'corners': corners.tolist() if corners is not None else None,
            'dimensions': {
                'width': cropped.shape[1],
                'height': cropped.shape[0]
            }
        }

    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
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
    result = crop_page_api(image_data)

    # Output JSON result
    print(json.dumps(result))


if __name__ == '__main__':
    main()
