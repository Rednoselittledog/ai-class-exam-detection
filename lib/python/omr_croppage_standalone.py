"""
OMR CropPage - Standalone Document Scanner
จาก OMRChecker CropPage Processor

Robust Document Detection ด้วย Morphology + Adaptive Epsilon
รับภาพเข้า → ตรวจจับเอกสาร → Perspective Transform → ส่งภาพออก
"""

import cv2
import numpy as np
from pathlib import Path
import argparse


# ==================== Core Functions ====================

def order_points(pts):
    """
    เรียงลำดับจุด 4 มุมของ rectangle

    Args:
        pts: numpy array shape (4, 2) หรือ (4, 1, 2)

    Returns:
        numpy array shape (4, 2) เรียงเป็น [top-left, top-right, bottom-right, bottom-left]
    """
    rect = np.zeros((4, 2), dtype="float32")
    pts = pts.reshape(4, 2)

    # Top-left point จะมี sum (x+y) น้อยที่สุด
    # Bottom-right point จะมี sum (x+y) มากที่สุด
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left
    rect[2] = pts[np.argmax(s)]  # bottom-right

    # Top-right point จะมี diff (y-x) น้อยที่สุด
    # Bottom-left point จะมี diff (y-x) มากที่สุด
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left

    return rect


def four_point_transform(image, pts):
    """
    ทำ perspective transform จาก 4 จุด

    Args:
        image: numpy array (BGR or grayscale)
        pts: numpy array shape (4, 2) - 4 มุมของเอกสาร

    Returns:
        warped: ภาพที่ transform แล้ว (มุมมองบนลงล่าง)
    """
    # เรียงลำดับจุด
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # คำนวณความกว้างของภาพใหม่
    # หาระยะห่างระหว่างจุดบนและล่าง
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # คำนวณความสูงของภาพใหม่
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # จุดปลายทาง (rectangle มาตรฐาน)
    dst = np.array([
        [0, 0],                           # top-left
        [maxWidth - 1, 0],                # top-right
        [maxWidth - 1, maxHeight - 1],    # bottom-right
        [0, maxHeight - 1]                # bottom-left
    ], dtype="float32")

    # คำนวณ perspective transform matrix
    M = cv2.getPerspectiveTransform(rect, dst)

    # ทำ transform
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped


def find_document_contour(image, min_area_ratio=0.1, epsilon_factors=None):
    """
    หา contour ของเอกสารด้วย Morphology + Adaptive Epsilon

    Args:
        image: numpy array (BGR image)
        min_area_ratio: contour ต้องมี area อย่างน้อย x% ของภาพ (default: 0.1 = 10%)
        epsilon_factors: list ของ epsilon factors สำหรับ approxPolyDP (default: [0.02, 0.01, 0.03, 0.04, 0.05])

    Returns:
        contour: numpy array shape (4, 1, 2) หรือ None ถ้าหาไม่เจอ
    """
    if epsilon_factors is None:
        epsilon_factors = [0.02, 0.01, 0.03, 0.04, 0.05]

    # Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Gaussian Blur เพื่อลด noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Otsu Thresholding (auto threshold)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Morphological operations เพื่อลด noise
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))

    # MORPH_CLOSE: ปิดช่องว่างเล็กๆ
    morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    # MORPH_OPEN: ลบ noise เล็กๆ
    morphed = cv2.morphologyEx(morphed, cv2.MORPH_OPEN, kernel)

    # Canny Edge Detection
    edged = cv2.Canny(morphed, 50, 150)

    # Dilate edges เพื่อให้ edges เชื่อมต่อกันดีขึ้น
    kernel_dilate = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edged, kernel_dilate, iterations=1)

    # หา contours
    contours, _ = cv2.findContours(dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # เรียงตาม area จากมากไปน้อย
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    # คำนวณ min area
    img_area = image.shape[0] * image.shape[1]
    min_area = img_area * min_area_ratio

    # ลอง epsilon factors ต่างๆ
    for epsilon_factor in epsilon_factors:
        for c in contours[:10]:  # ตรวจ 10 อันดับแรก
            area = cv2.contourArea(c)

            # Skip ถ้า area เล็กเกินไป
            if area < min_area:
                continue

            # Approximate polygon
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, epsilon_factor * peri, True)

            # ถ้าเป็น 4 มุม ถือว่าเจอแล้ว
            if len(approx) == 4:
                return approx

    return None


def crop_document(image, min_area_ratio=0.1, epsilon_factors=None, return_corners=False):
    """
    Crop เอกสารออกจากภาพ

    Args:
        image: numpy array (BGR image)
        min_area_ratio: contour ต้องมี area อย่างน้อย x% ของภาพ
        epsilon_factors: list ของ epsilon factors สำหรับ approxPolyDP
        return_corners: ถ้า True จะ return ทั้งภาพ crop และ corners

    Returns:
        cropped_image: ภาพที่ crop แล้ว หรือ None ถ้าตรวจจับไม่ได้
        corners (optional): numpy array shape (4, 2) - 4 มุมของเอกสาร
    """
    # หา contour ของเอกสาร
    contour = find_document_contour(image, min_area_ratio, epsilon_factors)

    if contour is None:
        return (None, None) if return_corners else None

    # Perspective transform
    warped = four_point_transform(image, contour.reshape(4, 2))

    if return_corners:
        return warped, contour.reshape(4, 2)
    else:
        return warped


# ==================== Batch Processing ====================

def batch_crop(input_folder, output_folder='cropped_output', min_area_ratio=0.1):
    """
    Crop เอกสารหลายไฟล์พร้อมกัน

    Args:
        input_folder: โฟลเดอร์ที่มีภาพต้นฉบับ
        output_folder: โฟลเดอร์สำหรับบันทึกผลลัพธ์
        min_area_ratio: contour ต้องมี area อย่างน้อย x% ของภาพ

    Returns:
        results: dict {'success': [...], 'failed': [...]}
    """
    import glob

    # สร้างโฟลเดอร์ output
    Path(output_folder).mkdir(exist_ok=True)

    # รองรับ extension ต่างๆ
    extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff', '*.tif']
    image_files = []
    for ext in extensions:
        image_files.extend(glob.glob(f"{input_folder}/{ext}"))
        image_files.extend(glob.glob(f"{input_folder}/{ext.upper()}"))

    results = {'success': [], 'failed': []}

    for i, image_path in enumerate(image_files, 1):
        try:
            filename = Path(image_path).name
            print(f"[{i}/{len(image_files)}] Processing: {filename}...", end=' ')

            # อ่านภาพ
            image = cv2.imread(image_path)
            if image is None:
                print("❌ Cannot read image")
                results['failed'].append({'file': filename, 'error': 'Cannot read image'})
                continue

            # Crop
            cropped = crop_document(image, min_area_ratio)

            if cropped is None:
                print("❌ Document not detected")
                results['failed'].append({'file': filename, 'error': 'Document not detected'})
                continue

            # บันทึก
            output_path = Path(output_folder) / f"cropped_{filename}"
            cv2.imwrite(str(output_path), cropped)

            print(f"✅ Saved to {output_path}")
            results['success'].append(str(output_path))

        except Exception as e:
            print(f"❌ Error: {e}")
            results['failed'].append({'file': filename, 'error': str(e)})

    return results


# ==================== CLI ====================

def main():
    parser = argparse.ArgumentParser(
        description='OMR CropPage - Robust Document Scanner',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Crop single image
  python omr_croppage_standalone.py document.jpg

  # Specify output file
  python omr_croppage_standalone.py document.jpg -o cropped.jpg

  # Adjust min area ratio (default: 0.1)
  python omr_croppage_standalone.py document.jpg --min-area 0.15

  # Batch processing
  python omr_croppage_standalone.py input_folder/ --batch -o output_folder/

  # Show debug visualization
  python omr_croppage_standalone.py document.jpg --debug
        """
    )

    parser.add_argument('input', help='Input image file or folder')
    parser.add_argument('-o', '--output', help='Output file or folder')
    parser.add_argument('--min-area', type=float, default=0.1,
                        help='Min area ratio (default: 0.1 = 10%% of image)')
    parser.add_argument('--batch', action='store_true',
                        help='Batch mode (process folder)')
    parser.add_argument('--debug', action='store_true',
                        help='Show debug visualization')

    args = parser.parse_args()

    if args.batch:
        # Batch mode
        output_folder = args.output if args.output else 'cropped_output'
        results = batch_crop(args.input, output_folder, args.min_area)

        print(f"\n{'='*50}")
        print(f"✅ Success: {len(results['success'])} images")
        print(f"❌ Failed:  {len(results['failed'])} images")
        print(f"📁 Output:  {output_folder}")
        print(f"{'='*50}")

    else:
        # Single image mode
        image = cv2.imread(args.input)
        if image is None:
            print(f"❌ Error: Cannot read image '{args.input}'")
            return

        print(f"📸 Processing: {args.input}")
        print(f"📏 Image size: {image.shape[1]}x{image.shape[0]}")

        # Crop
        if args.debug:
            cropped, corners = crop_document(image, args.min_area, return_corners=True)
        else:
            cropped = crop_document(image, args.min_area)

        if cropped is None:
            print("❌ Error: Document not detected")
            print("\n💡 Tips:")
            print("  - ลองปรับ --min-area ต่ำลง (เช่น 0.05)")
            print("  - ตรวจสอบว่าเอกสารมีขอบชัดเจน")
            print("  - ใช้ --debug เพื่อดู visualization")
            return

        # บันทึก
        if args.output:
            output_path = args.output
        else:
            input_path = Path(args.input)
            output_path = input_path.parent / f"{input_path.stem}_cropped{input_path.suffix}"

        cv2.imwrite(str(output_path), cropped)

        print(f"✅ Document detected!")
        print(f"📐 Output size: {cropped.shape[1]}x{cropped.shape[0]}")
        print(f"💾 Saved to: {output_path}")

        # Debug visualization
        if args.debug and corners is not None:
            debug_img = image.copy()

            # วาด contour
            cv2.drawContours(debug_img, [corners.reshape(-1, 1, 2).astype(np.int32)], -1, (0, 255, 0), 3)

            # วาดหมายเลขมุม
            for i, corner in enumerate(corners):
                cv2.circle(debug_img, tuple(corner.astype(int)), 10, (0, 0, 255), -1)
                cv2.putText(debug_img, str(i), tuple(corner.astype(int)),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

            # แสดงผล
            cv2.imshow('Original with Detected Corners', debug_img)
            cv2.imshow('Cropped Document', cropped)
            print("\n💡 Press any key to close...")
            cv2.waitKey(0)
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()


# ==================== Python API Usage ====================

"""
ตัวอย่างการใช้งานแบบ Python API:

# 1. Crop เอกสารเดียว
from omr_croppage_standalone import crop_document
import cv2

image = cv2.imread('document.jpg')
cropped = crop_document(image)
if cropped is not None:
    cv2.imwrite('cropped.jpg', cropped)

# 2. Crop พร้อมรับ corners
cropped, corners = crop_document(image, return_corners=True)
print(f"Corners: {corners}")

# 3. ปรับ min area ratio
cropped = crop_document(image, min_area_ratio=0.15)  # เอกสารต้องมีพื้นที่อย่างน้อย 15%

# 4. Batch processing
from omr_croppage_standalone import batch_crop

results = batch_crop('input_folder/', 'output_folder/')
print(f"Success: {len(results['success'])}")
print(f"Failed: {len(results['failed'])}")

# 5. ใช้แค่ find_document_contour
from omr_croppage_standalone import find_document_contour

contour = find_document_contour(image)
if contour is not None:
    # วาด contour บนภาพ
    cv2.drawContours(image, [contour], -1, (0, 255, 0), 3)
    cv2.imshow('Detected', image)
    cv2.waitKey(0)
"""
