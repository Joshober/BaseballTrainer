"""
Firebase authentication middleware for storage server
Verifies Firebase ID tokens for authenticated requests
"""
from functools import wraps
from flask import request, jsonify
import os
import firebase_admin
from firebase_admin import credentials, auth
from pathlib import Path
from dotenv import load_dotenv
import logging

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)
else:
    load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
_admin_app = None

def get_firebase_admin():
    """Initialize and return Firebase Admin app"""
    global _admin_app
    
    if _admin_app is None:
        # Check if already initialized
        if len(firebase_admin._apps) > 0:
            _admin_app = firebase_admin.get_app()
            return _admin_app
        
        # Get Firebase Admin credentials from environment
        project_id = os.getenv('FIREBASE_ADMIN_PROJECT_ID')
        client_email = os.getenv('FIREBASE_ADMIN_CLIENT_EMAIL')
        private_key = os.getenv('FIREBASE_ADMIN_PRIVATE_KEY', '').replace('\\n', '\n')
        
        if not project_id or not client_email or not private_key:
            logger.warning(
                "Firebase Admin SDK not configured. "
                "Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY"
            )
            return None
        
        try:
            cred = credentials.Certificate({
                'project_id': project_id,
                'client_email': client_email,
                'private_key': private_key,
            })
            _admin_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            return None
    
    return _admin_app

def verify_firebase_token(token: str):
    """Verify Firebase ID token and return decoded token"""
    try:
        admin_app = get_firebase_admin()
        if not admin_app:
            # Demo mode - allow requests without auth
            demo_mode = os.getenv('DEMO_MODE', 'False').lower() == 'true'
            if demo_mode:
                logger.info("Demo mode enabled - skipping token verification")
                return {'uid': 'demo_user', 'email': 'demo@example.com'}
            return None
        
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None

def require_auth(f):
    """
    Decorator that requires Firebase authentication
    Allows demo mode for testing without Firebase
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for demo mode
        demo_mode = os.getenv('DEMO_MODE', 'False').lower() == 'true'
        test_mode = os.getenv('TEST_MODE', 'False').lower() == 'true'
        
        if demo_mode or test_mode:
            # Demo mode: use demo user
            demo_user_id = os.getenv('DEMO_USER_ID', 'demo_user')
            request.user = {
                'uid': demo_user_id,
                'email': f'{demo_user_id}@demo.local',
                'source': 'demo'
            }
            logger.info(f'Demo mode enabled - using user: {demo_user_id}')
            return f(*args, **kwargs)
        
        # Check for Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Missing or invalid Authorization header'
            }), 401
        
        # Extract and verify token
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        decoded_token = verify_firebase_token(token)
        
        if not decoded_token:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid or expired token'
            }), 401
        
        # Attach user info to request
        request.user = {
            'uid': decoded_token.get('uid'),
            'email': decoded_token.get('email'),
            'source': 'firebase'
        }
        
        return f(*args, **kwargs)
    
    return decorated_function

