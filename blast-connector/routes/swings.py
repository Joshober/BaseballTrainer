"""
Swing Detection API endpoints
Handles swing detection via Flask service
"""
from flask import Blueprint, request, jsonify
from services.blast_service import BlastService
from services.swing_detection_service import SwingDetectionService
import logging
import os

logger = logging.getLogger(__name__)
bp = Blueprint('swings', __name__)

_blast_service = BlastService()
_swing_detection_service = SwingDetectionService(
    nextjs_api_url=os.getenv('NEXTJS_API_URL', 'http://localhost:3000')
)

# Export the service instance so debug route can access it
def get_swing_detection_service():
    return _swing_detection_service


@bp.route('/api/blast/swings', methods=['POST'])
def receive_swing_data():
    """
    Receive swing data (can be called from Next.js or internally)
    Body: { "t_start": ..., "t_peak": ..., "t_end": ..., "duration_ms": ..., 
            "omega_peak_dps": ..., "bat_speed_mph": ..., "attack_angle_deg": ..., 
            "timestamp": ..., "sessionId": "..." (optional) }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        # Extract swing data
        swing_data = {
            't_start': data.get('t_start'),
            't_peak': data.get('t_peak'),
            't_end': data.get('t_end'),
            'duration_ms': data.get('duration_ms'),
            'omega_peak_dps': data.get('omega_peak_dps'),
            'bat_speed_mph': data.get('bat_speed_mph'),
            'attack_angle_deg': data.get('attack_angle_deg'),
            'timestamp': data.get('timestamp'),
        }
        
        # If sessionId is provided, save to database
        session_id = data.get('sessionId')
        user_id = request.user.get('uid') if hasattr(request, 'user') and request.user else None
        
        if session_id and user_id:
            try:
                # Convert swing data to Blast data format
                blast_data = {
                    'deviceId': data.get('deviceId', 'BLE_SENSOR'),
                    'batSpeed': swing_data.get('bat_speed_mph'),
                    'attackAngle': swing_data.get('attack_angle_deg'),
                    'omegaPeak': swing_data.get('omega_peak_dps'),
                    'durationMs': swing_data.get('duration_ms'),
                    'swingData': swing_data,
                }
                
                _blast_service.save_blast_data(session_id, blast_data, user_id)
            except Exception as e:
                logger.warning(f"Failed to save swing data to database: {e}")
        
        return jsonify({
            'success': True,
            'received': swing_data
        })
    except Exception as e:
        logger.error(f'Error receiving swing data: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500


@bp.route('/api/blast/swing-detection/start', methods=['POST'])
def start_swing_detection():
    """
    Start swing detection for a session
    Body: { "sessionId": "..." }
    """
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'sessionId is required'
            }), 400
        
        result = _swing_detection_service.start_detection(session_id)
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400
    except Exception as e:
        logger.error(f'Error starting swing detection: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500


@bp.route('/api/blast/swing-detection/stop', methods=['POST'])
def stop_swing_detection():
    """
    Stop swing detection for a session
    Body: { "sessionId": "..." }
    """
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'sessionId is required'
            }), 400
        
        result = _swing_detection_service.stop_detection(session_id)
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 404
    except Exception as e:
        logger.error(f'Error stopping swing detection: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500


@bp.route('/api/blast/swing-detection/status', methods=['GET'])
def get_swing_detection_status():
    """
    Get swing detection status for a session
    Query params: sessionId
    """
    try:
        session_id = request.args.get('sessionId')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'sessionId is required'
            }), 400
        
        result = _swing_detection_service.get_status(session_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f'Error getting swing detection status: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

