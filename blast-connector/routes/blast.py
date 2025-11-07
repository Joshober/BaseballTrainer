"""
Blast Connect API endpoints
"""
from flask import Blueprint, request, jsonify
from middleware.auth import require_auth
from services.blast_service import BlastService
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('blast', __name__)

blast_service = BlastService()

@bp.route('/api/blast/connect', methods=['POST'])
@require_auth
def connect_blast():
    """
    Connect to Blast Motion sensor
    Body: { "deviceId": "...", "apiKey": "..." }
    """
    try:
        data = request.get_json()
        
        device_id = data.get('deviceId')
        api_key = data.get('apiKey')
        
        if not device_id or not api_key:
            return jsonify({
                'success': False,
                'error': 'deviceId and apiKey are required'
            }), 400
        
        result = blast_service.connect_device(device_id, api_key)
        
        return jsonify({
            'success': True,
            'connection': result
        })
    except Exception as e:
        logger.error(f'Error connecting to Blast: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/data', methods=['POST'])
@require_auth
def receive_blast_data():
    """
    Receive data from Blast Motion sensor
    Body: { "sessionId": "...", "data": {...} }
    """
    try:
        data = request.get_json()
        
        session_id = data.get('sessionId')
        blast_data = data.get('data')
        
        if not session_id or not blast_data:
            return jsonify({
                'success': False,
                'error': 'sessionId and data are required'
            }), 400
        
        result = blast_service.save_blast_data(session_id, blast_data, request.user.get('uid'))
        
        return jsonify({
            'success': True,
            'saved': result
        })
    except Exception as e:
        logger.error(f'Error saving Blast data: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/sessions', methods=['GET'])
@require_auth
def get_sessions():
    """
    Get all Blast sessions for the authenticated user
    Query params: limit, offset
    """
    try:
        limit = int(request.args.get('limit', 10))
        offset = int(request.args.get('offset', 0))
        user_id = request.user.get('uid')
        
        sessions = blast_service.get_user_sessions(user_id, limit, offset)
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        })
    except Exception as e:
        logger.error(f'Error getting sessions: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/sessions/<session_id>', methods=['GET'])
@require_auth
def get_session(session_id):
    """Get a specific Blast session with all data"""
    try:
        user_id = request.user.get('uid')
        session = blast_service.get_session(session_id, user_id)
        
        if not session:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        return jsonify({
            'success': True,
            'session': session
        })
    except Exception as e:
        logger.error(f'Error getting session: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/sessions/<session_id>', methods=['DELETE'])
@require_auth
def delete_session(session_id):
    """Delete a Blast session"""
    try:
        user_id = request.user.get('uid')
        success = blast_service.delete_session(session_id, user_id)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Session deleted successfully'
        })
    except Exception as e:
        logger.error(f'Error deleting session: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

