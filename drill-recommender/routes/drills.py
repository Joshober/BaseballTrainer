"""
Drill management endpoints
"""
from flask import Blueprint, request, jsonify
from middleware.auth import require_auth
from services.drill_service import DrillService
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('drills', __name__)

drill_service = DrillService()

@bp.route('/api/drills', methods=['GET'])
def get_drills():
    """
    Get all drills or filter by category
    Query params: category, difficulty, equipment
    """
    try:
        category = request.args.get('category')
        difficulty = request.args.get('difficulty')
        equipment = request.args.get('equipment')
        
        drills = drill_service.get_drills(
            category=category,
            difficulty=difficulty,
            equipment=equipment
        )
        
        return jsonify({
            'success': True,
            'drills': drills,
            'count': len(drills)
        })
    except Exception as e:
        logger.error(f'Error getting drills: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/drills/<drill_id>', methods=['GET'])
def get_drill(drill_id):
    """Get a specific drill by ID"""
    try:
        drill = drill_service.get_drill_by_id(drill_id)
        
        if not drill:
            return jsonify({
                'success': False,
                'error': 'Drill not found'
            }), 404
        
        return jsonify({
            'success': True,
            'drill': drill
        })
    except Exception as e:
        logger.error(f'Error getting drill: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/drills', methods=['POST'])
@require_auth
def create_drill():
    """Create a new drill (admin only)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'description', 'category', 'corrections']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        drill = drill_service.create_drill(data)
        
        return jsonify({
            'success': True,
            'drill': drill
        }), 201
    except Exception as e:
        logger.error(f'Error creating drill: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/drills/<drill_id>', methods=['PUT'])
@require_auth
def update_drill(drill_id):
    """Update an existing drill (admin only)"""
    try:
        data = request.get_json()
        
        drill = drill_service.update_drill(drill_id, data)
        
        if not drill:
            return jsonify({
                'success': False,
                'error': 'Drill not found'
            }), 404
        
        return jsonify({
            'success': True,
            'drill': drill
        })
    except Exception as e:
        logger.error(f'Error updating drill: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/drills/<drill_id>', methods=['DELETE'])
@require_auth
def delete_drill(drill_id):
    """Delete a drill (admin only)"""
    try:
        success = drill_service.delete_drill(drill_id)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Drill not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Drill deleted successfully'
        })
    except Exception as e:
        logger.error(f'Error deleting drill: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

