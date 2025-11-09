# Pose Detection Service Setup

## Python Version Requirement

**IMPORTANT:** MediaPipe requires Python 3.10 or 3.11. Python 3.13 is NOT supported.

## Installation

1. **Check Python version:**
   ```bash
   python3.10 --version
   # or
   python3.11 --version
   ```

2. **Install MediaPipe:**
   ```bash
   cd pose-detection-service
   python3.10 -m pip install mediapipe==0.10.8
   # or
   python3.11 -m pip install mediapipe==0.10.8
   ```

3. **Install all dependencies:**
   ```bash
   python3.10 -m pip install -r requirements.txt
   ```

## Running the Service

### Manual Start (Recommended)
```bash
cd pose-detection-service
PYTHON_BACKEND_PORT=5005 python3.10 app.py
```

### Using npm script
```bash
npm run dev:pose
```

The script will try Python 3.10 first, then fall back to the default Python.

## Port Configuration

The service runs on port **5005** by default (configured in `lib/utils/config.ts`).

Make sure your `.env.local` has:
```env
POSE_DETECTION_SERVICE_URL=http://localhost:5005
POSE_DETECTION_SERVICE_PORT=5005
```

## Verification

1. **Check if MediaPipe is installed:**
   ```bash
   python3.10 -c "import mediapipe; print('✅ MediaPipe OK')"
   ```

2. **Check if service is running:**
   ```bash
   curl http://localhost:5005/health
   ```

3. **Expected response:**
   ```json
   {
     "service": "python-backend",
     "status": "ok",
     "version": "1.0.0"
   }
   ```

## Troubleshooting

### MediaPipe not available error

**Problem:** `WARNING: MediaPipe not available`

**Solution:**
1. Make sure you're using Python 3.10 or 3.11
2. Install MediaPipe: `python3.10 -m pip install mediapipe==0.10.8`
3. Restart the service

### Service not responding

**Problem:** `Pose detection service unavailable`

**Solution:**
1. Check if service is running: `lsof -ti:5005`
2. Check logs: `tail -f /tmp/pose-detection.log`
3. Restart service: `PYTHON_BACKEND_PORT=5005 python3.10 pose-detection-service/app.py`

