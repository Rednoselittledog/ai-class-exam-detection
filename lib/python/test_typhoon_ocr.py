#!/usr/bin/env python3
"""Test Typhoon OCR API"""

import openai
import base64
import sys
import os

# Read API key from env
api_key = os.getenv('TYPHOON_OCR', '')
if not api_key:
    print("ERROR: TYPHOON_OCR not found in environment")
    sys.exit(1)

client = openai.OpenAI(
    api_key=api_key,
    base_url="https://api.opentyphoon.ai/v1"
)

# Test with simple text prompt first
print("Testing Typhoon API with text prompt...")
try:
    response = client.chat.completions.create(
        model="typhoon-v2.1-12b-instruct",
        messages=[
            {"role": "system", "content": "You are a helpful OCR assistant."},
            {"role": "user", "content": "Hello, can you see this message?"}
        ],
        temperature=0.7,
        max_tokens=100
    )
    print("SUCCESS! API is working.")
    print(f"Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

# Test vision endpoint (if supported)
print("\n" + "="*50)
print("Testing vision capabilities...")
print("Note: We need to check if this API supports vision/OCR")
print("If it's text-only, we'll need image_url or base64 support")
print("="*50)
