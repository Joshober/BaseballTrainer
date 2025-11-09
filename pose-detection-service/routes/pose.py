"""
Pose detection endpoints using MediaPipe
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import logging
import numpy as np
from PIL import Image
import io

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
    
    Supports two modes:
    1. Video file upload (multipart/form-data with 'video' file)
    2. Direct file path (form data with 'videoPath' parameter pointing to file in uploads folder)
    """
    try:
        from pathlib import Path
        import os
        
        # Get configuration parameters
        processing_mode = request.form.get('processingMode', 'full')
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '0')) or None
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        
        # Initialize video analyzer
        analyzer = VideoAnalyzer(
            processing_mode=processing_mode,
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        
        # Check if videoPath is provided (direct file system access)
        video_path = request.form.get('videoPath')
        if video_path:
            # Resolve upload directory (same logic as storage server)
            upload_dir_str = os.getenv('STORAGE_UPLOAD_DIR', 'uploads')
            if os.path.isabs(upload_dir_str):
                upload_dir = Path(upload_dir_str)
            else:
                # Try root project directory first
                root_uploads = Path(__file__).parent.parent.parent / upload_dir_str
                if root_uploads.exists():
                    upload_dir = root_uploads
                else:
                    upload_dir = Path(__file__).parent.parent / upload_dir_str
            
            # Normalize and validate path
            video_path = video_path.strip().strip('/').replace('\\', '/')
            
            # Security: Prevent directory traversal
            if '..' in video_path or video_path.startswith('/') or not video_path:
                return jsonify({
                    'error': 'Invalid video path',
                    'ok': False,
                    'message': 'Path contains invalid characters or directory traversal attempt'
                }), 400
            
            # Build full path
            full_path = upload_dir / video_path
            full_path = full_path.resolve()
            upload_dir_resolved = upload_dir.resolve()
            
            # Verify path is within upload directory
            try:
                full_path.relative_to(upload_dir_resolved)
            except ValueError:
                return jsonify({
                    'error': 'Invalid video path',
                    'ok': False,
                    'message': 'Path is outside upload directory'
                }), 400
            
            # Check if file exists
            if not full_path.exists():
                return jsonify({
                    'error': 'Video file not found',
                    'ok': False,
                    'message': f'Video file not found at path: {video_path}'
                }), 404
            
            # Analyze video from file path
            logger.info(f"Analyzing video from path: {full_path}")
            result = analyzer.analyze_video_from_path(str(full_path), full_path.name)
            return jsonify(result)
        
        # Fall back to file upload mode
        if 'video' not in request.files:
            return jsonify({
                'error': 'No video provided',
                'ok': False,
                'message': 'Either provide a video file or videoPath parameter'
            }), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video selected', 'ok': False}), 400
        
        # Read video bytes
        video_bytes = file.read()
        
        # Analyze video from bytes
        logger.info(f"Analyzing video from uploaded file: {file.filename}")
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

