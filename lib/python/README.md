# Python Image Processing Scripts

This directory contains Python scripts for image processing tasks using OpenCV.

## Setup

Install required dependencies:

```bash
cd lib/python
pip install -r requirements.txt
```

Or with specific Python version:

```bash
pip3 install -r requirements.txt
```

## Scripts

### crop_page.py

Auto-detects and crops paper boundaries from exam sheet images.

**Features:**
- Gaussian blur for noise reduction
- Canny edge detection
- Contour detection and validation
- Perspective transformation (four-point transform)
- Returns cropped and aligned image

**Usage:**

```bash
python3 crop_page.py <base64_image_data>
```

**Output:**
JSON with success status, cropped image (base64), and detected corners.

## Ported from OMRChecker

These scripts are ported from the [OMRChecker](https://github.com/Udayraj123/OMRChecker) project by Udayraj Deshmukh.

### Original Algorithm (CropPage.py)

1. **Gaussian Blur** - Noise reduction
2. **Thresholding** - Binary image conversion
3. **Morphological Closing** - Fill small holes
4. **Canny Edge Detection** - Detect edges
5. **Contour Detection** - Find shapes
6. **Polygon Approximation** - Simplify contours to rectangles
7. **Validation** - Check if contour is a valid rectangle
8. **Four-Point Transform** - Perspective correction

## Dependencies

- **opencv-python**: Computer vision library
- **numpy**: Numerical computing
- **Pillow**: Image processing library
