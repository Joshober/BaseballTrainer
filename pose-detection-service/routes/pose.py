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

