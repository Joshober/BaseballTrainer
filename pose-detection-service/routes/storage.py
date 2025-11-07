"""
File storage endpoints
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
bp = Blueprint('storage', __name__)

# Upload directory
UPLOAD_DIR = Path(__file__).parent.parent / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

@bp.route('/api/storage/upload', methods=['POST'])
def upload_file():
    """Upload a file to local storage"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Secure filename
        filename = secure_filename(file.filename)
        filepath = UPLOAD_DIR / filename
        
        # Save file
        file.save(str(filepath))
        
        return jsonify({
            'url': f'/api/storage/{filename}',
            'filename': filename
        })
    
    except Exception as e:
        logger.error(f'Upload error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/api/storage/<path:filename>', methods=['GET'])
def get_file(filename):
    """Get a file from local storage"""
    try:
        filepath = UPLOAD_DIR / secure_filename(filename)
        
        if not filepath.exists():
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(str(filepath))
    
    except Exception as e:
        logger.error(f'Get file error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/api/storage/<path:filename>', methods=['DELETE'])
def delete_file(filename):
    """Delete a file from local storage"""
    try:
        filepath = UPLOAD_DIR / secure_filename(filename)
        
        if not filepath.exists():
            return jsonify({'error': 'File not found'}), 404
        
        filepath.unlink()
        
        return jsonify({'message': 'File deleted'})
    
    except Exception as e:
        logger.error(f'Delete file error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

