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
else:
    # Fallback to local .env file
    load_dotenv()

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
    # Flask headers are case-insensitive, but we need to check the exact key
    internal_header = request.headers.get('X-Internal-Request') or request.headers.get('x-internal-request')
    logger.info(f"Checking internal request - X-Internal-Request header: {internal_header}")
    logger.info(f"All request headers: {list(request.headers.keys())}")
    if internal_header and str(internal_header).lower() == 'true':
        logger.info("Request identified as internal via X-Internal-Request header")
        return True
    
    # Check if request is from localhost (backend gateway)
    remote_addr = request.remote_addr
    forwarded_for = request.headers.get('X-Forwarded-For')
    logger.info(f"Request remote address: {remote_addr}, X-Forwarded-For: {forwarded_for}")
    
    # Check remote address - Flask might set this differently
    if remote_addr in ('127.0.0.1', 'localhost', '::1', None):
        logger.info("Request identified as internal via localhost address")
        return True
    
    # Also check X-Forwarded-For header
    if forwarded_for:
        forwarded_ips = [ip.strip() for ip in forwarded_for.split(',')]
        if any('127.0.0.1' in ip or 'localhost' in ip for ip in forwarded_ips):
            logger.info("Request identified as internal via X-Forwarded-For header")
            return True
    
    # Check if test mode is enabled
    test_mode = os.getenv('TEST_MODE', 'False').lower() == 'true'
    if test_mode:
        logger.debug("Request identified as internal via TEST_MODE")
        return True
    
    logger.warning(f"Request not identified as internal - header: {internal_header}, remote_addr: {remote_addr}")
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
            logger.warning(f'Request headers: X-Internal-Request={request.headers.get("X-Internal-Request")}, X-User-Id={request.headers.get("X-User-Id")}')
            logger.warning(f'All headers: {dict(request.headers)}')
            logger.warning(f'Remote addr: {request.remote_addr}, X-Forwarded-For: {request.headers.get("X-Forwarded-For")}')
            return jsonify({
                'error': 'Forbidden',
                'message': 'This service only accepts requests from the backend gateway. Enable DEMO_MODE=true for independent testing.',
                'debug': {
                    'remote_addr': request.remote_addr,
                    'x_internal_request': request.headers.get('X-Internal-Request'),
                    'x_user_id': request.headers.get('X-User-Id'),
                    'headers': list(request.headers.keys())
                }
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

