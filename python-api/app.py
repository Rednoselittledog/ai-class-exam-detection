"""
FastAPI app for OMR Detection
Runs YOLO model to detect OMR bubbles
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os

# Add parent directory to path to import omr_detect
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'lib', 'python'))
from omr_detect import detect_bubbles, sort_detections_to_answers, draw_detections_on_image
from io import BytesIO
from PIL import Image
import base64

app = FastAPI(title="OMR Detection API")

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DetectRequest(BaseModel):
    image: str  # Base64 encoded image

class DetectResponse(BaseModel):
    success: bool
    answers: list = []
    detections: list = []
    total_detected: int = 0
    annotated_image: str = ""
    error: str = ""

@app.get("/")
async def root():
    return {
        "name": "OMR Detection API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/detect-omr", response_model=DetectResponse)
async def detect_omr(request: DetectRequest):
    """
    Detect OMR bubbles from base64 image

    Args:
        request: DetectRequest with base64 image

    Returns:
        DetectResponse with detected answers and annotated image
    """
    try:
        if not request.image:
            raise HTTPException(status_code=400, detail="No image provided")

        # Detect bubbles
        detections = detect_bubbles(request.image)

        # Get image dimensions for column detection
        image_data = base64.b64decode(
            request.image.split(',')[1] if ',' in request.image else request.image
        )
        image = Image.open(BytesIO(image_data))
        img_width = image.width

        # Sort into answer array
        answers, sorted_detections = sort_detections_to_answers(detections, img_width)

        # Draw detections on image
        annotated_image = draw_detections_on_image(request.image, detections)

        return DetectResponse(
            success=True,
            answers=answers,
            detections=sorted_detections,
            total_detected=len(sorted_detections),
            annotated_image=annotated_image
        )

    except Exception as e:
        print(f"Error in detect-omr: {str(e)}")
        return DetectResponse(
            success=False,
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
