"""
Sync endpoints for integrating Blast data with main project
"""
from flask import Blueprint, request, jsonify
from middleware.auth import require_auth
from services.blast_service import BlastService
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('sync', __name__)

blast_service = BlastService()

@bp.route('/api/blast/sync/session', methods=['POST'])
@require_auth
def sync_session():
    """
    Sync Blast session data with main project session
    Body: { "blastSessionId": "...", "mainSessionId": "..." }
    """
    try:
        data = request.get_json()
        
        blast_session_id = data.get('blastSessionId')
        main_session_id = data.get('mainSessionId')
        
        if not blast_session_id or not main_session_id:
            return jsonify({
                'success': False,
                'error': 'blastSessionId and mainSessionId are required'
            }), 400
        
        user_id = request.user.get('uid')
        result = blast_service.sync_with_main_session(
            blast_session_id,
            main_session_id,
            user_id
        )
        
        return jsonify({
            'success': True,
            'sync': result
        })
    except Exception as e:
        logger.error(f'Error syncing session: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/sync/metrics', methods=['POST'])
@require_auth
def sync_metrics():
    """
    Sync Blast metrics with pose detection results
    Body: { "sessionId": "...", "poseMetrics": {...}, "blastMetrics": {...} }
    """
    try:
        data = request.get_json()
        
        session_id = data.get('sessionId')
        pose_metrics = data.get('poseMetrics', {})
        blast_metrics = data.get('blastMetrics', {})
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'sessionId is required'
            }), 400
        
        user_id = request.user.get('uid')
        result = blast_service.sync_metrics(
            session_id,
            pose_metrics,
            blast_metrics,
            user_id
        )
        
        return jsonify({
            'success': True,
            'combined': result
        })
    except Exception as e:
        logger.error(f'Error syncing metrics: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/blast/sync/compare', methods=['POST'])
@require_auth
def compare_data():
    """
    Compare Blast data with pose detection results
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
        
        user_id = request.user.get('uid')
        comparison = blast_service.compare_with_pose(session_id, user_id)
        
        return jsonify({
            'success': True,
            'comparison': comparison
        })
    except Exception as e:
        logger.error(f'Error comparing data: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

