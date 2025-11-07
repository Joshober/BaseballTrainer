"""
Drill search and recommendation endpoints
"""
from flask import Blueprint, request, jsonify
from services.drill_service import DrillService
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('search', __name__)

drill_service = DrillService()

@bp.route('/api/drills/recommend', methods=['POST'])
def recommend_drills():
    """
    Get drill recommendations based on swing analysis results
    
    Request body:
    {
        "corrections": ["low_launch_angle", "poor_hip_rotation"],
        "metrics": {
            "launchAngle": 15,
            "shoulderAngle": 45,
            "hipAngle": 10
        },
        "limit": 5
    }
    """
    try:
        data = request.get_json()
        
        corrections = data.get('corrections', [])
        metrics = data.get('metrics', {})
        limit = data.get('limit', 5)
        
        if not corrections and not metrics:
            return jsonify({
                'success': False,
                'error': 'Either corrections or metrics must be provided'
            }), 400
        
        recommendations = drill_service.recommend_drills(
            corrections=corrections,
            metrics=metrics,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    except Exception as e:
        logger.error(f'Error recommending drills: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@bp.route('/api/drills/search', methods=['GET', 'POST'])
def search_drills():
    """
    Search drills by query string or corrections
    
    GET: ?q=search_term
    POST: { "query": "search_term", "corrections": [...] }
    """
    try:
        if request.method == 'GET':
            query = request.args.get('q', '')
            corrections = request.args.getlist('corrections')
        else:
            data = request.get_json() or {}
            query = data.get('query', '')
            corrections = data.get('corrections', [])
        
        results = drill_service.search_drills(
            query=query,
            corrections=corrections
        )
        
        return jsonify({
            'success': True,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f'Error searching drills: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

