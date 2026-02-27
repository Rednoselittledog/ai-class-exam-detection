# ระบบ OMR Exam Detection

ระบบตั้งค่าและจัดการข้อสอบ OMR ด้วย Next.js + Tailwind CSS + Supabase

## คุณสมบัติ

- 📤 อัปโหลดรูปภาพข้อสอบ (JPG/PNG)
- ✂️ **ครอบและจัดหน้ากระดาษอัตโนมัติ** (Auto-Crop & Align) - ใช้ Computer Vision จาก OMRChecker
- 🎨 วาดและกำหนดฟิลด์บนภาพ
- 💾 บันทึกข้อมูลลง Supabase (Database + Storage)
- 📋 แสดงรายการข้อสอบทั้งหมด
- 👁️ ดูรายละเอียดข้อสอบพร้อม field overlays
- 🗑️ ลบข้อสอบพร้อมรูปภาพ

## การติดตั้ง

### 1. ติดตั้ง Dependencies

#### Node.js Dependencies
```bash
npm install
```

#### Python Dependencies (สำหรับ Auto-Crop)
```bash
cd lib/python
pip3 install -r requirements.txt
```

**Requirements:**
- Python 3.8+
- opencv-python >= 4.8.0
- numpy >= 1.26.0
- Pillow >= 10.0.0

### 2. ตั้งค่า Supabase

#### A. สร้าง Supabase Project
1. ไปที่ [supabase.com](https://supabase.com)
2. สร้าง project ใหม่
3. คัดลอก URL และ anon key จาก Settings > API

#### B. ตั้งค่า Environment Variables
สร้างไฟล์ `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### C. รัน Migration (สำคัญ!)

1. ไปที่ Supabase Dashboard > SQL Editor
2. คัดลอกโค้ดจาก `supabase/migrations/20250224_complete_setup.sql`
3. วางและกด Run
4. ควรเห็น "Setup complete! ✅"

### 3. เริ่มใช้งาน

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

## วิธีใช้งาน

### สร้างข้อสอบใหม่

1. คลิก "สร้างข้อสอบใหม่"
2. **ขั้นตอนที่ 1:** อัปโหลดรูปภาพข้อสอบ
3. **ขั้นตอนที่ 2:** วาดกรอบฟิลด์และกำหนดค่า
   - ชื่อฟิลด์
   - ประเภท: "ฝน" หรือ "ข้อเขียน"
   - การหมุน: 0°, 90°, 180°, 270°
   - มีเฉลยหรือไม่
4. **ขั้นตอนที่ 3:** ตรวจสอบและบันทึก

### ดูรายการข้อสอบ

1. คลิก "รายการข้อสอบ"
2. เลือกข้อสอบที่ต้องการดู
3. คลิก "ดูรายละเอียด" เพื่อดูภาพพร้อม field overlays

## โครงสร้างฐานข้อมูล

### ตาราง exams

```sql
id              uuid        Primary key
name            text        ชื่อข้อสอบ
canvas_size     integer[]   [width, height]
fields          jsonb       ข้อมูลฟิลด์
answer_key      jsonb       เฉลย
image_url       text        URL รูปภาพ
created_at      timestamptz วันที่สร้าง
updated_at      timestamptz วันที่อัปเดต
```

### Storage Bucket

- `answer-sheets` - เก็บรูปภาพข้อสอบ (Public access)

## แก้ปัญหา

### Error: Failed to upload image (500)

**สาเหตุ:** ยังไม่ได้รัน migration

**วิธีแก้:**
1. รัน SQL ใน `supabase/migrations/20250224_complete_setup.sql`
2. ตรวจสอบที่ Supabase Dashboard > Storage ว่ามี bucket `answer-sheets`

### Error: Failed to save exam

**ตรวจสอบ:**
- กรอกชื่อข้อสอบแล้วหรือยัง
- มีอย่างน้อย 1 ฟิลด์หรือยัง
- รัน migration แล้วหรือยัง

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (Database + Storage)
- **Image Processing:** Python + OpenCV (ported from [OMRChecker](https://github.com/Udayraj123/OMRChecker))
- **Libraries:** @supabase/ssr, react-dropzone

## Auto-Crop Feature

ระบบครอบและจัดหน้ากระดาษอัตโนมัติใช้ Computer Vision algorithms ที่ port มาจาก [OMRChecker](https://github.com/Udayraj123/OMRChecker):

### Algorithm Pipeline:
1. **Gaussian Blur** - ลดสัญญาณรบกวน
2. **Thresholding** - แปลงเป็นภาพขาว-ดำ
3. **Morphological Closing** - ปิดช่องว่างเล็ก
4. **Canny Edge Detection** - ตรวจจับขอบกระดาษ
5. **Contour Detection** - หาเส้นรอบกระดาษ
6. **Rectangle Validation** - ตรวจสอบว่าเป็นสี่เหลี่ยมจริง
7. **Four-Point Transform** - ปรับมุมมองให้ตรง (Perspective Correction)

### การใช้งาน:
- เปิด/ปิดได้ที่ checkbox "ครอบและจัดหน้าอัตโนมัติ" ใน Step 1
- ถ้าตรวจจับไม่สำเร็จ จะใช้รูปต้นฉบับแทน
- ทำงานดีที่สุดกับรูปที่เห็นทั้ง 4 มุมของกระดาษ

## License

MIT
