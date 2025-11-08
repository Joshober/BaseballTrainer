"""
Storage endpoints for file upload, retrieval, and deletion
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import logging
from pathlib import Path
from middleware.auth import require_auth

logger = logging.getLogger(__name__)
bp = Blueprint('storage', __name__)

# Get upload directory from environment or use default
UPLOAD_DIR = Path(os.getenv('STORAGE_UPLOAD_DIR', 'uploads'))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'image': {'jpg', 'jpeg', 'png', 'gif', 'webp'},
    'video': {'mp4', 'webm', 'mov', 'avi', 'mkv'}
}

def allowed_file(filename, file_type='image'):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    allowed = ALLOWED_EXTENSIONS.get(file_type, set())
    return ext in allowed

def get_content_type(filename):
    """Determine content type from file extension"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
    }
    return content_types.get(ext, 'application/octet-stream')

@bp.route('/api/storage/upload', methods=['POST'])
@require_auth
def upload_file():
    """Upload a file to storage"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get path from form data or use filename
        path = request.form.get('path')
        if not path:
            # Generate path based on user ID and filename
            user_id = request.user.get('uid', 'anonymous')
            filename = secure_filename(file.filename)
            path = f"{user_id}/{filename}"
        
        # Ensure path is secure (no directory traversal)
        path = secure_filename(path)
        if '..' in path or path.startswith('/'):
            return jsonify({'error': 'Invalid path'}), 400
        
        # Create full file path
        full_path = UPLOAD_DIR / path
        
        # Create directory if needed
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file.save(str(full_path))
        
        logger.info(f"File uploaded: {path} by user {request.user.get('sub')}")
        
        # Get storage server base URL (prioritize ngrok URL)
        base_url = os.getenv('NGROK_STORAGE_SERVER_URL')
        if not base_url:
            # Fallback to request host if ngrok URL not set
            base_url = request.host_url.rstrip('/')
        
        # Return full URL (with ngrok domain if configured)
        url = f"{base_url}/api/storage/{path}"
        return jsonify({
            'url': url,
            'path': path,
            'size': full_path.stat().st_size
        }), 200
    
    except Exception as e:
        logger.error(f'Upload error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@bp.route('/api/storage/<path:filepath>', methods=['GET'])
def get_file(filepath):
    """Get a file from storage"""
    try:
        # Ensure path is secure
        if '..' in filepath or filepath.startswith('/'):
            return jsonify({'error': 'Invalid path'}), 400
        
        full_path = UPLOAD_DIR / filepath
        
        if not full_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # Determine content type
        content_type = get_content_type(filepath)
        
        return send_file(
            str(full_path),
            mimetype=content_type,
            as_attachment=False
        )
    
    except Exception as e:
        logger.error(f'File retrieval error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/api/storage', methods=['DELETE'])
@require_auth
def delete_file():
    """Delete a file from storage"""
    try:
        path = request.args.get('path')
        if not path:
            return jsonify({'error': 'Missing path parameter'}), 400
        
        # Ensure path is secure
        if '..' in path or path.startswith('/'):
            return jsonify({'error': 'Invalid path'}), 400
        
        full_path = UPLOAD_DIR / path
        
        if not full_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # Verify user owns the file (path should start with user_id)
        # Auth0 uses 'sub' as the user ID
        user_id = request.user.get('sub', '')
        if not path.startswith(user_id + '/'):
            return jsonify({'error': 'Forbidden - you can only delete your own files'}), 403
        
        # Delete file
        full_path.unlink()
        
        logger.info(f"File deleted: {path} by user {request.user.get('sub')}")
        
        return jsonify({'message': 'File deleted successfully'}), 200
    
    except Exception as e:
        logger.error(f'File deletion error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

