# Python Backend

Flask-based backend for baseball swing analysis using MediaPipe pose detection.

## Setup

1. **Install Python dependencies:**
   ```bash
   cd python-backend
   pip install -r requirements.txt
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

3. **Run the server:**
   ```bash
   # Development mode
   python app.py
   
   # Or with gunicorn (production)
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Pose Detection
- `POST /api/pose/detect` - Detect pose from uploaded image
  - Body: `multipart/form-data` with `image` field
  - Returns: JSON with swing angles and metrics

### Storage
- `POST /api/storage/upload` - Upload file
- `GET /api/storage/<filename>` - Get file
- `DELETE /api/storage/<filename>` - Delete file

## Features

- **MediaPipe Pose Detection**: High-accuracy pose estimation
- **Baseball Swing Metrics**: Calculates shoulder angle, hand angle, hip rotation, launch angle
- **CORS Enabled**: Works with frontend from different origins
- **File Storage**: Local file storage for uploaded images/videos

## Configuration

Set `BACKEND_TYPE=python` in your `.env.local` to use the Python backend instead of Express.

