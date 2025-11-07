"""
Auth0 authentication middleware for storage server
Verifies Auth0 access tokens for authenticated requests
"""
from functools import wraps
from flask import request, jsonify
import os
import jwt
import requests
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

# Cache for JWKS
_jwks_cache = None

def get_jwks():
    """Get JWKS (JSON Web Key Set) from Auth0"""
    global _jwks_cache
    
    if _jwks_cache is None:
        domain = os.getenv('AUTH0_DOMAIN')
        if not domain:
            logger.warning("AUTH0_DOMAIN is not configured")
            return None
        
        try:
            jwks_url = f"https://{domain}/.well-known/jwks.json"
            response = requests.get(jwks_url, timeout=10)
            response.raise_for_status()
            _jwks_cache = response.json()
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            return None
    
    return _jwks_cache

def get_signing_key(token):
    """Get the signing key for a JWT token"""
    jwks = get_jwks()
    if not jwks:
        return None
    
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        
        if not kid:
            return None
        
        # Find the key with matching kid
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)
        
        return None
    except Exception as e:
        logger.error(f"Failed to get signing key: {e}")
        return None

def verify_auth0_token(token: str):
    """Verify Auth0 access token and return decoded token"""
    try:
        domain = os.getenv('AUTH0_DOMAIN')
        audience = os.getenv('AUTH0_AUDIENCE')
        
        if not domain:
            logger.warning("AUTH0_DOMAIN is not configured")
            return None
        
        # Get signing key
        signing_key = get_signing_key(token)
        if not signing_key:
            return None
        
        # Verify token
        decoded = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            audience=audience or f"https://{domain}/api/v2/",
            issuer=f"https://{domain}/"
        )
        
        return decoded
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return None

def require_auth(f):
    """
    Decorator that requires Auth0 authentication
    Allows demo mode for testing without Auth0
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
                'sub': demo_user_id,
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
        decoded_token = verify_auth0_token(token)
        
        if not decoded_token:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid or expired token'
            }), 401
        
        # Attach user info to request
        # Auth0 uses 'sub' as the user ID (equivalent to Firebase 'uid')
        request.user = {
            'sub': decoded_token.get('sub'),
            'email': decoded_token.get('email'),
            'source': 'auth0'
        }
        
        return f(*args, **kwargs)
    
    return decorated_function
