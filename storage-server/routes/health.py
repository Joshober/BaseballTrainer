"""
Health check endpoint
"""
from flask import Blueprint, jsonify
import os

bp = Blueprint('health', __name__)

@bp.route('/health', methods=['GET'])
@bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'storage-server',
        'version': '1.0.0'
    })

