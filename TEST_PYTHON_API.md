# วิธี Test Python API

## ขั้นตอนการ Setup และ Test

### 1. เปิด Terminal ตัวที่ 1 - รัน Python API

```bash
cd python-api

# สร้าง virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# หรือ
venv\Scripts\activate  # Windows

# ติดตั้ง dependencies
pip install -r requirements.txt

# รัน server
python app.py
```

Server จะรันที่: **http://localhost:8000**

### 2. เปิด Terminal ตัวที่ 2 - รัน Next.js

```bash
# ที่ root project
npm run dev
```

Next.js จะรันที่: **http://localhost:3000**

### 3. ทดสอบ

1. เปิดเบราว์เซอร์ไปที่ http://localhost:3000
2. ทดสอบสร้างข้อสอบใหม่และแสกน OMR
3. ระบบจะเรียก Python API ที่ localhost:8000 โดยอัตโนมัติ

### 4. ตรวจสอบ Python API

เปิดเบราว์เซอร์ไปที่:
- **http://localhost:8000** - หน้าแรก (status)
- **http://localhost:8000/docs** - API Documentation (Swagger UI)
- **http://localhost:8000/health** - Health check

### 5. Deploy ไป Render.com

เมื่อ test ใน localhost สำเร็จแล้ว:

1. Push code ไป GitHub:
```bash
git add .
git commit -m "Add Python API for OMR detection"
git push
```

2. ไปที่ https://render.com
3. สร้าง **New Web Service**
4. เชื่อมต่อ GitHub repo
5. ตั้งค่า:
   - **Root Directory:** `python-api`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3
6. กด **Create Web Service**

6. หลัง deploy สำเร็จ จะได้ URL เช่น: `https://omr-detection-api.onrender.com`

7. อัพเดท environment variable ใน Vercel:
   - ไปที่ Vercel Dashboard > Settings > Environment Variables
   - เพิ่ม: `PYTHON_API_URL` = `https://omr-detection-api.onrender.com`
   - Redeploy Next.js app

### Troubleshooting

**ถ้า Python API ไม่ทำงาน:**
- ตรวจสอบว่า YOLO model อยู่ที่ `../lib/python/OMR/best.pt`
- ตรวจสอบ console output ของ Python server
- ลอง restart server

**ถ้า Next.js ไม่เชื่อมต่อ Python API:**
- ตรวจสอบว่า `PYTHON_API_URL` ตั้งค่าถูกต้องใน `.env.local`
- Restart Next.js dev server

**ถ้า CORS error:**
- Python API มี CORS middleware อยู่แล้ว ควรทำงาน
- ถ้ายังมีปัญหา ให้เพิ่ม domain ของคุณใน `allow_origins` ใน `app.py`
