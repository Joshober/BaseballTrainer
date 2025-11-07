"""
Health check endpoint
"""
from flask import Blueprint, jsonify

bp = Blueprint('health', __name__)

@bp.route('/health', methods=['GET'])
@bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'blast-connector',
        'version': '1.0.0'
    })

