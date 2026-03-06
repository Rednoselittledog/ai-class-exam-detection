#!/usr/bin/env python3
"""
OCR Detection using Typhoon OCR API
Extracts text from handwritten fields
"""

import sys
import json
import base64
import os
from openai import OpenAI

def extract_text_from_image(image_base64, api_key):
    """
    Extract text using Typhoon OCR

    Args:
        image_base64: Base64 encoded image
        api_key: Typhoon API key

    Returns:
        Extracted text string
    """
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.opentyphoon.ai/v1"
    )

    # Prepare message with image
    messages = [{
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "Extract all text from this image. Return only the text content without any additional formatting or explanation."
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{image_base64.split(',')[1] if ',' in image_base64 else image_base64}"
                }
            },
        ],
    }]

    # Call API
    response = client.chat.completions.create(
        model="typhoon-ocr-preview",
        messages=messages,
        max_tokens=1024,
        temperature=0.1  # Low temperature for consistent OCR
    )

    text = response.choices[0].message.content.strip()
    return text

def main():
    """
    CLI interface
    Usage: python ocr_detect.py <base64_image>
    Output: JSON with {success, text}
    """
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No image provided'}))
        sys.exit(1)

    try:
        image_base64 = sys.argv[1]

        # Get API key from environment
        api_key = os.getenv('TYPHOON_OCR', '')
        if not api_key:
            raise Exception('TYPHOON_OCR environment variable not set')

        # Extract text
        text = extract_text_from_image(image_base64, api_key)

        result = {
            'success': True,
            'text': text
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
