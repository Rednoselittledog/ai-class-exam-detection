# OMR Detection Python API

FastAPI server for OMR (Optical Mark Recognition) detection using YOLO model.

## Local Development

### 1. Setup Python Virtual Environment

```bash
cd python-api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Copy YOLO Model

Make sure the YOLO model files are in the correct location:
```bash
# The model should be at: ../lib/python/OMR/best.pt
ls ../lib/python/OMR/best.pt
```

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn app:app --reload --port 8000

# Or run directly
python app.py
```

The API will be available at: http://localhost:8000

### 5. Test the API

Visit http://localhost:8000 to see the API status.

Visit http://localhost:8000/docs for interactive API documentation.

## API Endpoints

### GET /
Health check endpoint

### GET /health
Returns API health status

### POST /detect-omr
Detect OMR bubbles from base64 image

**Request:**
```json
{
  "image": "data:image/png;base64,..."
}
```

**Response:**
```json
{
  "success": true,
  "answers": ["a", "b", "c", ...],
  "detections": [...],
  "total_detected": 10,
  "annotated_image": "data:image/png;base64,..."
}
```

## Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render.com
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3
5. Deploy!

## Environment Variables

- `PORT`: Server port (default: 8000)
