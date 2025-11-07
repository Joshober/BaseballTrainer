# Pose Detection Service Setup Guide

## Overview

The Pose Detection Service uses **MediaPipe** for pose detection, which provides:
- ✅ Better accuracy than TensorFlow.js Node
- ✅ No native binding issues on Windows
- ✅ Pre-trained models included
- ✅ Easy to extend with custom models

## Installation

1. **Install Python 3.8+** (if not already installed)
   - Download from: https://www.python.org/downloads/
   - Make sure to check "Add Python to PATH" during installation

2. **Install dependencies:**
   ```bash
   cd pose-detection-service
   pip install -r requirements.txt
   ```

   If you encounter issues, try:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Create `.env` file:**
   ```bash
   cd pose-detection-service
   cp .env.example .env
   ```

   Edit `.env` if needed (defaults work for local development).

## Running the Service

### Development Mode
```bash
npm run dev:pose
```

Or directly:
```bash
cd pose-detection-service
python app.py
```

### Production Mode (with Gunicorn)
```bash
npm run dev:pose:gunicorn
```

Or directly:
```bash
cd pose-detection-service
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Configuration

The service runs on port 5000 by default and is accessed through the main backend gateway.

### Using Ngrok with Pose Detection Service

1. **Update `ngrok.yml`:**
   ```yaml
   version: 3
   agent:
     authtoken: YOUR_AUTH_TOKEN
   endpoints:
     - name: pose_detection_service
       url: your-custom-domain.ngrok.app
       upstream:
         url: http://localhost:5000
   ```

2. **Set environment variables:**
   ```env
   NGROK_POSE_DETECTION_URL=https://your-custom-domain.ngrok.app
   NEXT_PUBLIC_NGROK_POSE_DETECTION_URL=https://your-custom-domain.ngrok.app
   ```

3. **Start ngrok:**
   ```bash
   ngrok start pose_detection_service
   ```

## API Endpoints

### Pose Detection
```bash
POST /api/pose/detect
Content-Type: multipart/form-data
Body: { image: <file> }
```

**Response:**
```json
{
  "ok": true,
  "shoulderAngle": 45.2,
  "handAngle": 38.5,
  "hipAngle": 12.3,
  "launchAngle": 40.1,
  "confidence": 0.85,
  "detectedLandmarks": 8
}
```

### Health Check
```bash
GET /health
```

## Troubleshooting

### Import Errors
If you see import errors, make sure you're in the `python-backend` directory:
```bash
cd python-backend
python app.py
```

### Port Already in Use
If port 5000 is already in use, change it in `.env`:
```env
PYTHON_BACKEND_PORT=5001
```

And update `.env.local`:
```env
PYTHON_BACKEND_URL=http://localhost:5001
```

### MediaPipe Installation Issues
If MediaPipe fails to install:
```bash
pip install --upgrade pip
pip install mediapipe --no-cache-dir
```

### CORS Errors
CORS is enabled by default. If you still see errors, check that:
- The frontend is calling the correct backend URL
- `BACKEND_TYPE=python` is set in `.env.local`

## Adding Custom Models

To use a custom baseball swing detection model:

1. **Add model file** to `python-backend/models/`
2. **Create a new service** in `python-backend/services/`
3. **Update `routes/pose.py`** to use your custom model

Example structure:
```
python-backend/
  models/
    baseball_swing_model.h5
  services/
    custom_detector.py
```

## Performance

- **MediaPipe**: ~30-50ms per image on CPU
- **With GPU**: Can be faster if CUDA is available
- **Gunicorn**: Use 4 workers for production

## Next Steps

- ✅ Python backend is ready to use
- ✅ MediaPipe pose detection is working
- 🔄 You can add custom models from GitHub
- 🔄 You can fine-tune the pose detection metrics

