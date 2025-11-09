"""
Unified Baseball Swing Analysis Backend
Single Flask server with all services inlined - no imports from service directories
"""
import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify, redirect, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from functools import wraps

# Get root directory
root_dir = Path(__file__).parent.parent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
env_local = root_dir / '.env.local'
if env_local.exists():
    try:
        load_dotenv(env_local)
        logger.info(f"Loaded environment from {env_local}")
    except Exception as e:
        logger.warning(f"Failed to load .env.local: {e}")
        load_dotenv()
else:
    load_dotenv()
    logger.info("Loaded environment from local .env file")

app = Flask(__name__)
CORS(app)

# ============================================================================
# IMPORTS
# ============================================================================
import numpy as np
from PIL import Image
import io
import cv2
import tempfile
import base64
import requests
from urllib.parse import urlencode, quote
import json
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from werkzeug.utils import secure_filename
import jwt
from typing import Dict, List, Optional, Tuple, Any

# Try to import mediapipe
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    mp = None
    logger.warning("MediaPipe not available. Pose detection will be disabled.")

# ============================================================================
# AUTH MIDDLEWARE
# ============================================================================

_jwks_cache = None

def get_jwks():
    """Get JWKS from Auth0"""
    global _jwks_cache
    if _jwks_cache is None:
        domain = os.getenv('AUTH0_DOMAIN')
        if not domain:
            raise ValueError('AUTH0_DOMAIN is not configured')
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url, timeout=5)
            response.raise_for_status()
            _jwks_cache = response.json()
        except Exception as e:
            logger.error(f'Failed to fetch JWKS: {str(e)}')
            raise
    return _jwks_cache

def get_signing_key(token):
    """Get signing key for JWT verification"""
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')
        if not kid:
            raise ValueError('Token header missing kid')
        jwks = get_jwks()
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                from cryptography.hazmat.primitives.asymmetric import rsa
                from cryptography.hazmat.backends import default_backend
                from cryptography.hazmat.primitives import serialization
                n = int.from_bytes(base64.urlsafe_b64decode(key['n'] + '=='), 'big')
                e = int.from_bytes(base64.urlsafe_b64decode(key['e'] + '=='), 'big')
                public_key = rsa.RSAPublicNumbers(e, n).public_key(default_backend())
                pem = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                )
                return pem
        raise ValueError(f'Key with kid {kid} not found in JWKS')
    except Exception as e:
        logger.error(f'Failed to get signing key: {str(e)}')
        raise

def verify_token(token):
    """Verify Auth0 JWT token"""
    try:
        domain = os.getenv('AUTH0_DOMAIN')
        audience = os.getenv('AUTH0_AUDIENCE')
        client_id = os.getenv('AUTH0_CLIENT_ID')
        if not domain:
            raise ValueError('AUTH0_DOMAIN is not configured')
        signing_key = get_signing_key(token)
        issuer = f"https://{domain}/"
        options = {
            'verify_signature': True,
            'verify_exp': True,
            'verify_iat': True,
            'verify_iss': True,
            'verify_aud': False
        }
        audiences = []
        if audience:
            audiences.append(audience)
        if client_id:
            audiences.append(client_id)
        decoded = None
        for aud in audiences:
            try:
                decoded = jwt.decode(token, signing_key, algorithms=['RS256'], issuer=issuer, audience=aud, options=options)
                break
            except jwt.InvalidAudienceError:
                continue
        if decoded is None:
            options['verify_aud'] = False
            decoded = jwt.decode(token, signing_key, algorithms=['RS256'], issuer=issuer, options=options)
        return decoded
    except Exception as e:
        logger.error(f'Token verification failed: {str(e)}')
        return None

def require_auth(f):
    """Decorator that requires Auth0 authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        demo_mode = os.getenv('DEMO_MODE', 'False').lower() == 'true'
        test_mode = os.getenv('TEST_MODE', 'False').lower() == 'true'
        if demo_mode or test_mode:
            demo_user_id = os.getenv('DEMO_USER_ID', 'demo_user')
            request.user = {
                'sub': demo_user_id,
                'uid': demo_user_id,
                'source': 'demo',
                'email': f'{demo_user_id}@demo.local',
                'name': 'Demo User'
            }
            logger.info(f'Demo mode enabled - using user: {demo_user_id}')
            return f(*args, **kwargs)
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized', 'message': 'Missing or invalid Authorization header'}), 401
        token = auth_header[7:].strip()
        decoded = verify_token(token)
        if not decoded:
            return jsonify({'error': 'Unauthorized', 'message': 'Invalid or expired token'}), 401
        request.user = decoded
        request.user_id = decoded.get('sub') or decoded.get('user_id') or 'anonymous'
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# POSE DETECTOR SERVICE
# ============================================================================

class PoseDetector:
    """MediaPipe-based pose detector for baseball swing analysis"""
    
    def __init__(self, use_person_detection: bool = True, auto_crop: bool = True):
        if not MEDIAPIPE_AVAILABLE:
            self.mp_pose = None
            self.pose = None
            self.use_person_detection = False
            self.auto_crop = False
            logger.warning("MediaPipe not available. Pose detection disabled.")
            return
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=False,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6
        )
        self.use_person_detection = use_person_detection
        self.auto_crop = auto_crop
        logger.info("MediaPipe Pose detector initialized")
    
    def detect_pose(self, image: np.ndarray) -> Dict:
        """Detect pose from image and calculate baseball swing metrics"""
        if not MEDIAPIPE_AVAILABLE or self.pose is None:
            return {
                'ok': False,
                'error': 'MediaPipe not available',
                'message': 'MediaPipe is not installed. Please install mediapipe or use Python 3.11 or 3.12.'
            }
        try:
            if len(image.shape) == 3 and image.shape[2] == 3:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if hasattr(cv2, 'cvtColor') else image
            else:
                image_rgb = image
            results = self.pose.process(image_rgb)
            if not results.pose_landmarks:
                return {'ok': False, 'message': 'No pose detected'}
            landmarks = results.pose_landmarks.landmark
            h, w = image_rgb.shape[:2]
            metrics = self._calculate_swing_metrics(landmarks, (h, w))
            landmarks_list = [{'x': lm.x, 'y': lm.y, 'z': lm.z, 'visibility': lm.visibility} for lm in landmarks]
            return {'ok': True, 'landmarks': landmarks_list, **metrics}
        except Exception as e:
            logger.error(f"Error in pose detection: {str(e)}", exc_info=True)
            return {'ok': False, 'error': str(e)}
    
    def _calculate_swing_metrics(self, landmarks: List, image_shape: Tuple[int, int]) -> Dict:
        """Calculate baseball swing metrics from pose landmarks"""
        h, w = image_shape[:2]
        def get_landmark(name: str) -> Optional[Tuple[float, float]]:
            if not MEDIAPIPE_AVAILABLE or self.mp_pose is None:
                return None
            landmark_map = {
                'left_shoulder': self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                'right_shoulder': self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
                'left_elbow': self.mp_pose.PoseLandmark.LEFT_ELBOW,
                'right_elbow': self.mp_pose.PoseLandmark.RIGHT_ELBOW,
                'left_wrist': self.mp_pose.PoseLandmark.LEFT_WRIST,
                'right_wrist': self.mp_pose.PoseLandmark.RIGHT_WRIST,
                'left_hip': self.mp_pose.PoseLandmark.LEFT_HIP,
                'right_hip': self.mp_pose.PoseLandmark.RIGHT_HIP,
            }
            if name not in landmark_map:
                return None
            landmark_idx = landmark_map[name]
            if landmark_idx >= len(landmarks):
                return None
            lm = landmarks[landmark_idx]
            return (lm.x * w, lm.y * h)
        left_shoulder = get_landmark('left_shoulder')
        right_shoulder = get_landmark('right_shoulder')
        shoulder_angle = None
        if left_shoulder and right_shoulder:
            dx = right_shoulder[0] - left_shoulder[0]
            dy = right_shoulder[1] - left_shoulder[1]
            shoulder_angle = np.degrees(np.arctan2(dy, dx))
        right_elbow = get_landmark('right_elbow')
        right_wrist = get_landmark('right_wrist')
        left_elbow = get_landmark('left_elbow')
        left_wrist = get_landmark('left_wrist')
        hand_angle = None
        if right_elbow and right_wrist:
            dx = right_wrist[0] - right_elbow[0]
            dy = right_wrist[1] - right_elbow[1]
            hand_angle = np.degrees(np.arctan2(dy, dx))
        elif left_elbow and left_wrist:
            dx = left_wrist[0] - left_elbow[0]
            dy = left_wrist[1] - left_elbow[1]
            hand_angle = np.degrees(np.arctan2(dy, dx))
        left_hip = get_landmark('left_hip')
        right_hip = get_landmark('right_hip')
        hip_angle = None
        if left_hip and right_hip:
            dx = right_hip[0] - left_hip[0]
            dy = right_hip[1] - left_hip[1]
            hip_angle = np.degrees(np.arctan2(dy, dx))
        launch_angle = None
        if shoulder_angle is not None and hand_angle is not None:
            launch_angle = (hand_angle * 0.7 + shoulder_angle * 0.3)
        detected_landmarks = sum([
            left_shoulder is not None, right_shoulder is not None,
            left_elbow is not None, right_elbow is not None,
            left_wrist is not None, right_wrist is not None,
            left_hip is not None, right_hip is not None,
        ])
        confidence = detected_landmarks / 8.0
        return {
            'shoulderAngle': float(shoulder_angle) if shoulder_angle is not None else None,
            'handAngle': float(hand_angle) if hand_angle is not None else None,
            'hipAngle': float(hip_angle) if hip_angle is not None else None,
            'launchAngle': float(launch_angle) if launch_angle is not None else None,
            'confidence': float(confidence),
            'detectedLandmarks': detected_landmarks,
        }
    
    def __del__(self):
        if hasattr(self, 'pose') and self.pose:
            self.pose.close()

# Initialize pose detector
pose_detector = PoseDetector()

# ============================================================================
# VIDEO ANALYZER SERVICE (Simplified)
# ============================================================================

class VideoAnalyzer:
    """Simplified video analyzer for baseball swing analysis"""
    
    def __init__(self, processing_mode: str = 'full', sample_rate: int = 1,
                 max_frames: Optional[int] = None, enable_yolo: bool = True,
                 yolo_confidence: float = 0.5, batter_height_m: Optional[float] = None):
        self.processing_mode = processing_mode
        self.sample_rate = sample_rate
        self.max_frames = max_frames
        self.enable_yolo = enable_yolo
        self.yolo_confidence = yolo_confidence
        self.pose_detector = PoseDetector()
    
    def analyze_video(self, video_bytes: bytes, filename: str = 'video.mp4') -> Dict:
        """Analyze video file"""
        temp_file = None
        try:
            temp_fd, temp_path = tempfile.mkstemp(suffix='.mp4')
            temp_file = temp_path
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(video_bytes)
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                return {'ok': False, 'error': 'Could not open video file'}
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = frame_count / fps if fps > 0 else 0
            frames_data = []
            frame_idx = 0
            processed_frames = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if self.processing_mode == 'sampled':
                    if frame_idx % self.sample_rate != 0:
                        frame_idx += 1
                        continue
                if self.max_frames and processed_frames >= self.max_frames:
                    break
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pose_result = self.pose_detector.detect_pose(frame_rgb)
                frame_data = {
                    'frameIndex': frame_idx,
                    'timestamp': frame_idx / fps if fps > 0 else 0,
                    'pose': pose_result.get('landmarks') if pose_result.get('ok') else None,
                }
                if pose_result.get('ok'):
                    frame_data.update({
                        'shoulderAngle': pose_result.get('shoulderAngle'),
                        'handAngle': pose_result.get('handAngle'),
                        'hipAngle': pose_result.get('hipAngle'),
                        'launchAngle': pose_result.get('launchAngle'),
                    })
                frames_data.append(frame_data)
                processed_frames += 1
                frame_idx += 1
            cap.release()
            # Calculate aggregated metrics
            valid_frames = [f for f in frames_data if f.get('pose') is not None]
            avg_shoulder_angle = np.mean([f['shoulderAngle'] for f in valid_frames if f.get('shoulderAngle') is not None]) if valid_frames else None
            avg_hand_angle = np.mean([f['handAngle'] for f in valid_frames if f.get('handAngle') is not None]) if valid_frames else None
            avg_hip_angle = np.mean([f['hipAngle'] for f in valid_frames if f.get('hipAngle') is not None]) if valid_frames else None
            return {
                'ok': True,
                'videoInfo': {
                    'fps': float(fps),
                    'frameCount': frame_count,
                    'duration': float(duration),
                    'width': width,
                    'height': height
                },
                'metrics': {
                    'avgShoulderAngle': float(avg_shoulder_angle) if avg_shoulder_angle is not None else None,
                    'avgHandAngle': float(avg_hand_angle) if avg_hand_angle is not None else None,
                    'avgHipAngle': float(avg_hip_angle) if avg_hip_angle is not None else None,
                },
                'frames': frames_data[:50]  # Limit to first 50 frames for response size
            }
        except Exception as e:
            logger.error(f"Video analysis error: {str(e)}", exc_info=True)
            return {'ok': False, 'error': str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"Could not delete temp file: {e}")

# ============================================================================
# DRILL SERVICE
# ============================================================================

class DrillService:
    """Service for managing baseball drills"""
    
    def __init__(self):
        mongodb_uri = os.getenv('MONGODB_URI', '')
        if not mongodb_uri:
            raise ValueError('MONGODB_URI environment variable is required.')
        mongodb_uri = mongodb_uri.strip('"\'')
        database_name = os.getenv('MONGODB_DATABASE', 'baseball')
        try:
            from urllib.parse import urlparse
            parsed = urlparse(mongodb_uri)
            if parsed.path and parsed.path != '/':
                db_from_uri = parsed.path.lstrip('/').split('/')[0]
                if db_from_uri:
                    database_name = db_from_uri
        except Exception:
            pass
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database(database_name)
        self.drills_collection = self.db.drills
        self._create_indexes()
        logger.info("DrillService initialized")
    
    def _create_indexes(self):
        try:
            self.drills_collection.create_index([('category', ASCENDING)])
            self.drills_collection.create_index([('difficulty', ASCENDING)])
        except Exception as e:
            logger.warning(f"Error creating indexes: {str(e)}")
    
    def get_drills(self, category: Optional[str] = None, difficulty: Optional[str] = None,
                   equipment: Optional[str] = None) -> List[Dict]:
        query = {}
        if category:
            query['category'] = category
        if difficulty:
            query['difficulty'] = difficulty
        if equipment:
            query['equipment'] = {'$in': [equipment]}
        drills = list(self.drills_collection.find(query).sort('name', ASCENDING))
        for drill in drills:
            drill['_id'] = str(drill['_id'])
        return drills
    
    def get_drill_by_id(self, drill_id: str) -> Optional[Dict]:
        try:
            drill = self.drills_collection.find_one({'_id': ObjectId(drill_id)})
            if drill:
                drill['_id'] = str(drill['_id'])
            return drill
        except Exception:
            return None

# Initialize drill service
try:
    drill_service = DrillService()
except Exception as e:
    logger.error(f"Failed to initialize DrillService: {e}")
    drill_service = None

# ============================================================================
# BLAST SERVICE
# ============================================================================

class BlastService:
    """Service for managing Blast Motion sensor data"""
    
    def __init__(self):
        mongodb_uri = os.getenv('MONGODB_URI', '')
        if not mongodb_uri:
            raise ValueError('MONGODB_URI environment variable is required.')
        mongodb_uri = mongodb_uri.strip('"\'')
        database_name = os.getenv('MONGODB_DATABASE', 'baseball')
        try:
            from urllib.parse import urlparse
            parsed = urlparse(mongodb_uri)
            if parsed.path and parsed.path != '/':
                db_from_uri = parsed.path.lstrip('/').split('/')[0]
                if db_from_uri:
                    database_name = db_from_uri
        except Exception:
            pass
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database(database_name)
        self.blast_sessions_collection = self.db.blast_sessions
        self.blast_data_collection = self.db.blast_data
        self._create_indexes()
        logger.info("BlastService initialized")
    
    def _create_indexes(self):
        try:
            self.blast_sessions_collection.create_index([('userId', ASCENDING)])
            self.blast_sessions_collection.create_index([('createdAt', DESCENDING)])
        except Exception as e:
            logger.warning(f"Error creating indexes: {str(e)}")
    
    def connect_device(self, device_id: str, api_key: str) -> Dict:
        return {
            'deviceId': device_id,
            'apiKey': api_key,
            'connectedAt': datetime.utcnow().isoformat(),
            'status': 'connected'
        }
    
    def save_blast_data(self, session_id: str, blast_data: Dict, user_id: str) -> Dict:
        session = self.blast_sessions_collection.find_one({'sessionId': session_id, 'userId': user_id})
        if not session:
            session = {
                'sessionId': session_id,
                'userId': user_id,
                'deviceId': blast_data.get('deviceId', ''),
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }
            result = self.blast_sessions_collection.insert_one(session)
            session['_id'] = str(result.inserted_id)
        data_record = {
            'sessionId': session_id,
            'userId': user_id,
            'data': blast_data,
            'createdAt': datetime.utcnow()
        }
        result = self.blast_data_collection.insert_one(data_record)
        data_record['_id'] = str(result.inserted_id)
        return data_record
    
    def get_user_sessions(self, user_id: str, limit: int = 10, offset: int = 0) -> List[Dict]:
        sessions = list(self.blast_sessions_collection.find({'userId': user_id})
                       .sort('createdAt', DESCENDING).skip(offset).limit(limit))
        for session in sessions:
            session['_id'] = str(session['_id'])
        return sessions

# Initialize blast service
try:
    blast_service = BlastService()
except Exception as e:
    logger.error(f"Failed to initialize BlastService: {e}")
    blast_service = None

# ============================================================================
# AUTH ROUTES
# ============================================================================

@app.route('/api/auth/login', methods=['GET'])
def login():
    """Redirect to Auth0 login"""
    domain = os.getenv('AUTH0_DOMAIN')
    client_id = os.getenv('AUTH0_CLIENT_ID')
    backend_url = os.getenv('AUTH0_BASE_URL', f"http://localhost:{os.getenv('BACKEND_PORT', 3001)}")
    frontend_url = os.getenv('NEXT_PUBLIC_FRONTEND_URL', 'http://localhost:3000')
    connection = request.args.get('connection', 'google-oauth2')
    if not domain or not client_id:
        logger.error('[Auth Login] Auth0 not configured')
        error_msg = urlencode({'error': 'Auth0 is not configured.'})
        return redirect(f"{frontend_url}/login?{error_msg}")
    auth_url = f"https://{domain}/authorize?" + urlencode({
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': f"{backend_url}/api/auth/callback",
        'scope': 'openid profile email',
        'connection': connection,
    })
    return redirect(auth_url)

@app.route('/api/auth/callback', methods=['GET'])
def callback():
    """Handle Auth0 callback"""
    code = request.args.get('code')
    error = request.args.get('error')
    frontend_url = os.getenv('NEXT_PUBLIC_FRONTEND_URL', 'http://localhost:3000')
    if error:
        return redirect(f"{frontend_url}/login?error={quote(error)}")
    if not code:
        return redirect(f"{frontend_url}/login?error={quote('No authorization code received.')}")
    try:
        domain = os.getenv('AUTH0_DOMAIN')
        client_id = os.getenv('AUTH0_CLIENT_ID')
        client_secret = os.getenv('AUTH0_CLIENT_SECRET')
        backend_url = os.getenv('AUTH0_BASE_URL', f"http://localhost:{os.getenv('BACKEND_PORT', 3001)}")
        if not domain or not client_id or not client_secret:
            return redirect(f"{frontend_url}/login?error={quote('Auth0 is not configured.')}")
        token_response = requests.post(f"https://{domain}/oauth/token", json={
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': f"{backend_url}/api/auth/callback"
        })
        if token_response.status_code != 200:
            error_data = token_response.json() if token_response.text else {}
            error_msg = error_data.get('error_description') or error_data.get('error') or 'Authentication failed'
            return redirect(f"{frontend_url}/login?error={quote(error_msg)}")
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        id_token = token_data.get('id_token')
        user_response = requests.get(f"https://{domain}/userinfo", headers={'Authorization': f"Bearer {access_token}"})
        if user_response.status_code != 200:
            return redirect(f"{frontend_url}/login?error={quote('Failed to get user information.')}")
        user = user_response.json()
        token_to_use = id_token or access_token
        encoded_token = quote(token_to_use)
        encoded_user = quote(json.dumps(user))
        return redirect(f"{frontend_url}/auth/callback?token={encoded_token}&user={encoded_user}")
    except Exception as e:
        logger.error(f'[Auth Callback] Error: {str(e)}', exc_info=True)
        return redirect(f"{frontend_url}/login?error={quote(str(e))}")

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register new user with email/password"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        domain = os.getenv('AUTH0_DOMAIN')
        client_id = os.getenv('AUTH0_CLIENT_ID')
        if not domain or not client_id:
            return jsonify({'error': 'Auth0 not configured'}), 500
        signup_response = requests.post(f"https://{domain}/dbconnections/signup", json={
            'client_id': client_id,
            'email': email,
            'password': password,
            'connection': 'Username-Password-Authentication'
        })
        if signup_response.status_code == 409:
            return jsonify({'error': 'User already exists', 'message': 'An account with this email already exists.'}), 409
        if signup_response.status_code != 200:
            error_data = signup_response.json() if signup_response.text else {}
            error_msg = error_data.get('description') or error_data.get('error') or 'Registration failed'
            return jsonify({'error': error_msg}), signup_response.status_code
        return jsonify({'success': True, 'message': 'Account created successfully.', 'email': email})
    except Exception as e:
        logger.error(f'[Auth Register] Error: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login-email', methods=['POST'])
def login_email():
    """Login with email/password"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        domain = os.getenv('AUTH0_DOMAIN')
        client_id = os.getenv('AUTH0_CLIENT_ID')
        client_secret = os.getenv('AUTH0_CLIENT_SECRET')
        if not domain or not client_id or not client_secret:
            return jsonify({'error': 'Auth0 not configured'}), 500
        token_response = requests.post(f"https://{domain}/oauth/token", json={
            'grant_type': 'password',
            'client_id': client_id,
            'client_secret': client_secret,
            'username': email,
            'password': password,
            'connection': 'Username-Password-Authentication',
            'scope': 'openid profile email'
        })
        if token_response.status_code != 200:
            error_data = token_response.json() if token_response.text else {}
            error_msg = error_data.get('description') or error_data.get('error') or 'Login failed'
            return jsonify({'error': error_msg}), token_response.status_code
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        id_token = token_data.get('id_token')
        user_response = requests.get(f"https://{domain}/userinfo", headers={'Authorization': f"Bearer {access_token}"})
        if user_response.status_code != 200:
            return jsonify({'error': 'Failed to get user information'}), 500
        user = user_response.json()
        token_to_use = id_token or access_token
        return jsonify({'access_token': token_to_use, 'id_token': id_token, 'user': user})
    except Exception as e:
        logger.error(f'[Auth Login Email] Error: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 401

@app.route('/api/auth/logout', methods=['GET'])
def logout():
    """Logout from Auth0"""
    domain = os.getenv('AUTH0_DOMAIN')
    client_id = os.getenv('AUTH0_CLIENT_ID')
    return_to = request.args.get('returnTo', os.getenv('NEXT_PUBLIC_FRONTEND_URL', 'http://localhost:3000'))
    if not domain or not client_id:
        return jsonify({'error': 'Auth0 not configured'}), 500
    logout_url = f"https://{domain}/v2/logout?" + urlencode({'client_id': client_id, 'returnTo': return_to})
    return redirect(logout_url)

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'python-backend', 'version': '2.0.0'})

# ============================================================================
# POSE DETECTION ROUTES
# ============================================================================

@app.route('/api/pose/detect', methods=['POST'])
@require_auth
def detect_pose():
    """Detect pose from uploaded image"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided', 'ok': False}), 400
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image selected', 'ok': False}), 400
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image_array = np.array(image)
        result = pose_detector.detect_pose(image_array)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Pose detection error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error', 'ok': False, 'message': str(e)}), 500

@app.route('/api/pose/analyze-video', methods=['POST'])
@require_auth
def analyze_video():
    """Analyze video for baseball swing"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video provided', 'ok': False}), 400
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video selected', 'ok': False}), 400
        processing_mode = request.form.get('processingMode', 'full')
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '0')) or None
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        video_bytes = file.read()
        analyzer = VideoAnalyzer(
            processing_mode=processing_mode,
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        result = analyzer.analyze_video(video_bytes, file.filename)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Video analysis error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error', 'ok': False, 'message': str(e)}), 500

@app.route('/api/pose/analyze-live', methods=['POST'])
@require_auth
def analyze_live():
    """Analyze live video stream"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video stream provided', 'ok': False}), 400
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video stream selected', 'ok': False}), 400
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '30')) or None
        video_bytes = file.read()
        analyzer = VideoAnalyzer(processing_mode='streaming', sample_rate=sample_rate, max_frames=max_frames)
        result = analyzer.analyze_video(video_bytes, file.filename)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Live stream analysis error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error', 'ok': False, 'message': str(e)}), 500

# ============================================================================
# DRILL ROUTES
# ============================================================================

@app.route('/api/drills', methods=['GET'])
def get_drills():
    """Get all drills or filter by category"""
    try:
        if drill_service is None:
            return jsonify({'success': False, 'error': 'Drill service not available'}), 500
        category = request.args.get('category')
        difficulty = request.args.get('difficulty')
        equipment = request.args.get('equipment')
        drills = drill_service.get_drills(category=category, difficulty=difficulty, equipment=equipment)
        return jsonify({'success': True, 'drills': drills, 'count': len(drills)})
    except Exception as e:
        logger.error(f'Error getting drills: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error', 'message': str(e)}), 500

@app.route('/api/drills/<drill_id>', methods=['GET'])
def get_drill(drill_id):
    """Get a specific drill by ID"""
    try:
        if drill_service is None:
            return jsonify({'success': False, 'error': 'Drill service not available'}), 500
        drill = drill_service.get_drill_by_id(drill_id)
        if not drill:
            return jsonify({'success': False, 'error': 'Drill not found'}), 404
        return jsonify({'success': True, 'drill': drill})
    except Exception as e:
        logger.error(f'Error getting drill: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error', 'message': str(e)}), 500

# ============================================================================
# BLAST ROUTES
# ============================================================================

@app.route('/api/blast/connect', methods=['POST'])
@require_auth
def connect_blast():
    """Connect to Blast Motion sensor"""
    try:
        if blast_service is None:
            return jsonify({'success': False, 'error': 'Blast service not available'}), 500
        data = request.get_json()
        device_id = data.get('deviceId')
        api_key = data.get('apiKey')
        if not device_id or not api_key:
            return jsonify({'success': False, 'error': 'deviceId and apiKey are required'}), 400
        result = blast_service.connect_device(device_id, api_key)
        return jsonify({'success': True, 'connection': result})
    except Exception as e:
        logger.error(f'Error connecting to Blast: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error', 'message': str(e)}), 500

@app.route('/api/blast/data', methods=['POST'])
@require_auth
def receive_blast_data():
    """Receive data from Blast Motion sensor"""
    try:
        if blast_service is None:
            return jsonify({'success': False, 'error': 'Blast service not available'}), 500
        data = request.get_json()
        session_id = data.get('sessionId')
        blast_data = data.get('data')
        if not session_id or not blast_data:
            return jsonify({'success': False, 'error': 'sessionId and data are required'}), 400
        result = blast_service.save_blast_data(session_id, blast_data, request.user.get('uid'))
        return jsonify({'success': True, 'saved': result})
    except Exception as e:
        logger.error(f'Error saving Blast data: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error', 'message': str(e)}), 500

@app.route('/api/blast/sessions', methods=['GET'])
@require_auth
def get_sessions():
    """Get all Blast sessions for the authenticated user"""
    try:
        if blast_service is None:
            return jsonify({'success': False, 'error': 'Blast service not available'}), 500
        limit = int(request.args.get('limit', 10))
        offset = int(request.args.get('offset', 0))
        user_id = request.user.get('uid')
        sessions = blast_service.get_user_sessions(user_id, limit, offset)
        return jsonify({'success': True, 'sessions': sessions, 'count': len(sessions)})
    except Exception as e:
        logger.error(f'Error getting sessions: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error', 'message': str(e)}), 500

# ============================================================================
# STORAGE ROUTES
# ============================================================================

UPLOAD_DIR = Path(os.getenv('STORAGE_UPLOAD_DIR', 'uploads'))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.route('/api/storage/upload', methods=['POST'])
@require_auth
def upload_file():
    """Upload a file to storage"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        path = request.form.get('path')
        if not path:
            user_id = request.user.get('uid', 'anonymous')
            filename = secure_filename(file.filename)
            path = f"{user_id}/{filename}"
        path = secure_filename(path)
        if '..' in path or path.startswith('/'):
            return jsonify({'error': 'Invalid path'}), 400
        full_path = UPLOAD_DIR / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(str(full_path))
        logger.info(f"File uploaded: {path} by user {request.user.get('sub')}")
        return jsonify({'url': f"/api/storage/{path}", 'path': path, 'size': full_path.stat().st_size}), 200
    except Exception as e:
        logger.error(f'Upload error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@app.route('/api/storage/<path:filepath>', methods=['GET'])
def get_file(filepath):
    """Get a file from storage"""
    try:
        if '..' in filepath or filepath.startswith('/'):
            return jsonify({'error': 'Invalid path'}), 400
        full_path = UPLOAD_DIR / filepath
        if not full_path.exists():
            return jsonify({'error': 'File not found'}), 404
        ext = filepath.rsplit('.', 1)[1].lower() if '.' in filepath else ''
        content_types = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'gif': 'image/gif', 'webp': 'image/webp',
            'mp4': 'video/mp4', 'webm': 'video/webm',
            'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
        }
        content_type = content_types.get(ext, 'application/octet-stream')
        return send_file(str(full_path), mimetype=content_type, as_attachment=False)
    except Exception as e:
        logger.error(f'File retrieval error: {str(e)}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with service information"""
    return jsonify({
        'service': 'Unified Baseball Swing Analysis Backend',
        'version': '2.0.0',
        'status': 'running',
        'services': {
            'auth': 'Auth0 authentication',
            'pose_detection': 'Pose detection and video analysis',
            'drill_recommender': 'Drill recommendations',
            'blast_connector': 'Blast Motion sensor integration',
            'storage': 'File storage'
        }
    })

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path}")

if __name__ == '__main__':
    port = int(os.getenv('BACKEND_PORT', os.getenv('GATEWAY_PORT', 3001)))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    logger.info(f"Starting unified backend on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)

