"""
Pose detection endpoints using MediaPipe
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import logging
import numpy as np
from PIL import Image
import io
import cv2
import tempfile
import os
import base64

from services.pose_detector import PoseDetector
from services.video_analyzer import VideoAnalyzer
from middleware.auth import require_auth

logger = logging.getLogger(__name__)
bp = Blueprint('pose', __name__)

# Initialize pose detector
pose_detector = PoseDetector()

@bp.route('/api/pose/detect', methods=['POST'])
@require_auth
def detect_pose():
    """
    Detect pose from uploaded image
    Returns swing angles and baseball-specific metrics
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided', 'ok': False}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image selected', 'ok': False}), 400
        
        # Read image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL Image to numpy array
        image_array = np.array(image)
        
        # Run pose detection
        result = pose_detector.detect_pose(image_array)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Pose detection error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/analyze-video', methods=['POST'])
@require_auth
def analyze_video():
    """
    Analyze video for baseball swing
    Returns comprehensive swing analysis with pose, bat, ball detection, and metrics
    """
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video provided', 'ok': False}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video selected', 'ok': False}), 400
        
        # Get configuration parameters
        processing_mode = request.form.get('processingMode', 'full')
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '0')) or None
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        
        # Read video bytes
        video_bytes = file.read()
        
        # Initialize video analyzer
        analyzer = VideoAnalyzer(
            processing_mode=processing_mode,
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        
        # Analyze video
        result = analyzer.analyze_video(video_bytes, file.filename)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Video analysis error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/analyze-live', methods=['POST'])
@require_auth
def analyze_live():
    """
    Analyze live video stream for baseball swing
    Returns progressive results for real-time feedback
    """
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video stream provided', 'ok': False}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video stream selected', 'ok': False}), 400
        
        # Get configuration parameters
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '30')) or None  # Default 30 frames for live
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        
        # Read video bytes
        video_bytes = file.read()
        
        # Initialize video analyzer with streaming mode
        analyzer = VideoAnalyzer(
            processing_mode='streaming',
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        
        # Analyze video (same as analyze-video but with streaming optimizations)
        result = analyzer.analyze_video(video_bytes, file.filename)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Live stream analysis error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/extract-frames', methods=['POST'])
@require_auth
def extract_frames():
    """
    Extract frames from video (every 5th frame) and return as base64-encoded images
    Returns array of base64 frame data with frame indices
    """
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video provided', 'ok': False}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video selected', 'ok': False}), 400
        
        # Get frame interval (default: every 5th frame)
        frame_interval = int(request.form.get('frameInterval', '5'))
        
        # Read video bytes
        video_bytes = file.read()
        
        # Save video to temporary file
        temp_file = None
        try:
            # Create temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix='.mp4')
            temp_file = temp_path
            
            # Write video bytes to temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(video_bytes)
            
            # Open video with OpenCV
            cap = cv2.VideoCapture(temp_path)
            
            if not cap.isOpened():
                return jsonify({
                    'ok': False,
                    'error': 'Could not open video file'
                }), 400
            
            # Extract frames
            frames = []
            frame_idx = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Extract every Nth frame (default: every 5th)
                if frame_idx % frame_interval == 0:
                    # Convert BGR to RGB
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    
                    # Convert to PIL Image
                    pil_image = Image.fromarray(frame_rgb)
                    
                    # Convert to base64
                    buffer = io.BytesIO()
                    pil_image.save(buffer, format='JPEG', quality=85)
                    img_bytes = buffer.getvalue()
                    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                    
                    frames.append({
                        'frameIndex': frame_idx,
                        'image': f'data:image/jpeg;base64,{img_base64}'
                    })
                
                frame_idx += 1
            
            cap.release()
            
            return jsonify({
                'ok': True,
                'frames': frames,
                'totalFrames': frame_idx,
                'extractedFrames': len(frames)
            })
        
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f'Failed to delete temp file: {e}')
    
    except Exception as e:
        logger.error(f'Frame extraction error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

