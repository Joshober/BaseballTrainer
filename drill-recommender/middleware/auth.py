"""
Gateway authentication middleware
All authentication is handled by the backend gateway.
Flask services trust requests from the gateway (internal requests).
"""
from functools import wraps
from flask import request, jsonify
import os
from pathlib import Path
from dotenv import load_dotenv
import logging

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)

logger = logging.getLogger(__name__)

def is_internal_request():
    """
    Check if request is from backend gateway (internal request)
    All authentication is handled by the gateway, so we trust internal requests.
    Returns True if:
    - Request has X-Internal-Request header (set by gateway)
    - Request is from localhost/127.0.0.1 (gateway runs on same machine)
    - TEST_MODE is enabled
    """
    # Check for internal request header (set by backend gateway)
    if request.headers.get('X-Internal-Request') == 'true':
        return True
    
    # Check if request is from localhost (backend gateway)
    remote_addr = request.remote_addr
    if remote_addr in ('127.0.0.1', 'localhost', '::1'):
        return True
    
    # Check if test mode is enabled
    test_mode = os.getenv('TEST_MODE', 'False').lower() == 'true'
    if test_mode:
        return True
    
    return False

def require_auth(f):
    """
    Decorator that trusts requests from backend gateway OR allows demo mode.
    In demo mode, uses a demo user for independent testing.
    
    Usage:
        @bp.route('/api/endpoint')
        @require_auth
        def endpoint():
            # request.user will contain user info from gateway or demo user
            pass
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if demo mode is enabled
        demo_mode = os.getenv('DEMO_MODE', 'False').lower() == 'true'
        test_mode = os.getenv('TEST_MODE', 'False').lower() == 'true'
        
        if demo_mode or test_mode:
            # Demo mode: use demo user for independent testing
            demo_user_id = os.getenv('DEMO_USER_ID', 'demo_user')
            request.user = {
                'uid': demo_user_id,
                'source': 'demo',
                'email': f'{demo_user_id}@demo.local',
                'name': 'Demo User'
            }
            logger.info(f'Demo mode enabled - using user: {demo_user_id}')
            return f(*args, **kwargs)
        
        # Production mode: check if this is an internal request from backend gateway
        is_internal = is_internal_request()
        
        if not is_internal:
            # Reject requests not from gateway
            logger.warning(f'Rejected external request from {request.remote_addr}')
            return jsonify({
                'error': 'Forbidden',
                'message': 'This service only accepts requests from the backend gateway. Enable DEMO_MODE=true for independent testing.'
            }), 403
        
        # Trust internal requests from gateway
        # Gateway handles all authentication, so we just need to extract user info if available
        user_id = request.headers.get('X-User-Id', 'anonymous')
        
        # Create a simple user object for compatibility
        request.user = {
            'uid': user_id,
            'source': 'gateway'
        }
        
        return f(*args, **kwargs)
    
    return decorated_function

