"""
Pose detection endpoints using MediaPipe
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import logging
import numpy as np
from PIL import Image
import io

from services.pose_detector import PoseDetector
from services.video_analyzer import VideoAnalyzer
from services.storage_client import StorageClient
from services.video_frame_extractor import VideoFrameExtractor
from services.claude_analyzer import ClaudeAnalyzer
from services.database_client import DatabaseClient
from middleware.auth import require_auth

logger = logging.getLogger(__name__)
bp = Blueprint('pose', __name__)

# Initialize pose detector
pose_detector = PoseDetector()

@bp.route('/api/pose/detect', methods=['POST'])
@require_auth
def detect_pose():
    """
    Detect pose from uploaded image
    Returns swing angles and baseball-specific metrics
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided', 'ok': False}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image selected', 'ok': False}), 400
        
        # Read image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL Image to numpy array
        image_array = np.array(image)
        
        # Run pose detection
        result = pose_detector.detect_pose(image_array)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Pose detection error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/analyze-video', methods=['POST'])
@require_auth
def analyze_video():
    """
    Analyze video for baseball swing
    Returns comprehensive swing analysis with pose, bat, ball detection, and metrics
    """
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video provided', 'ok': False}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video selected', 'ok': False}), 400
        
        # Get configuration parameters
        processing_mode = request.form.get('processingMode', 'full')
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '0')) or None
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        
        # Read video bytes
        video_bytes = file.read()
        
        # Initialize video analyzer
        analyzer = VideoAnalyzer(
            processing_mode=processing_mode,
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        
        # Analyze video
        result = analyzer.analyze_video(video_bytes, file.filename)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Video analysis error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/analyze-live', methods=['POST'])
@require_auth
def analyze_live():
    """
    Analyze live video stream for baseball swing
    Returns progressive results for real-time feedback
    """
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video stream provided', 'ok': False}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video stream selected', 'ok': False}), 400
        
        # Get configuration parameters
        sample_rate = int(request.form.get('sampleRate', '1'))
        max_frames = int(request.form.get('maxFrames', '30')) or None  # Default 30 frames for live
        enable_yolo = request.form.get('enableYOLO', 'true').lower() == 'true'
        yolo_confidence = float(request.form.get('yoloConfidence', '0.5'))
        calibration = request.form.get('calibration')
        batter_height_m = float(calibration) if calibration else None
        
        # Read video bytes
        video_bytes = file.read()
        
        # Initialize video analyzer with streaming mode
        analyzer = VideoAnalyzer(
            processing_mode='streaming',
            sample_rate=sample_rate,
            max_frames=max_frames,
            enable_yolo=enable_yolo,
            yolo_confidence=yolo_confidence,
            batter_height_m=batter_height_m
        )
        
        # Analyze video (same as analyze-video but with streaming optimizations)
        result = analyzer.analyze_video(video_bytes, file.filename)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Live stream analysis error: {str(e)}', exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'ok': False,
            'message': str(e)
        }), 500

@bp.route('/api/pose/analyze-video-claude', methods=['POST'])
@require_auth
def analyze_video_claude():
    """
    Analyze video using Claude 3.5 Sonnet via OpenRouter
    Accepts either session_id or video_id
    If session_id is provided, looks up session to extract video_id
    Fetches video from storage-server, extracts frames, sends to Claude for analysis
    Returns a text recommendation
    """
    try:
        # Get JSON body
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON', 'ok': False}), 400
        
        data = request.get_json()
        session_id = data.get('session_id')
        video_id = data.get('video_id')
        
        # Get user_id from header (set by backend gateway)
        user_id = request.headers.get('X-User-Id')
        if not user_id or user_id == 'anonymous':
            return jsonify({'error': 'User ID not found in request', 'ok': False}), 401
        
        final_video_id = video_id
        storage_path = None
        
        # If session_id is provided, look up the session to get video path
        if session_id and not video_id:
            try:
                db_client = DatabaseClient()
                session = db_client.get_session(session_id)
                
                if not session:
                    return jsonify({
                        'error': 'Session not found',
                        'message': f'Session {session_id} does not exist',
                        'ok': False
                    }), 404
                
                # Extract video path from session
                # videoPath format: videos/{uid}/{filename}.{ext}
                # videoURL format: http://host/api/storage/videos_{uid}_{filename}.{ext}
                storage_path = None
                
                if session.get('videoPath'):
                    # Use videoPath directly - it's already in the correct format
                    # Format: videos/{uid}/{filename}.{ext}
                    storage_path = session['videoPath']
                    logger.info(f"Using videoPath from session: {storage_path}")
                elif session.get('videoURL'):
                    # Extract path from videoURL
                    # Format: http://host/api/storage/videos_{uid}_{filename}.{ext}
                    try:
                        from urllib.parse import urlparse
                        parsed_url = urlparse(session['videoURL'])
                        # Extract path after /api/storage/
                        url_path = parsed_url.path
                        if url_path.startswith('/api/storage/'):
                            # Remove /api/storage/ prefix to get the storage path
                            storage_path = url_path[len('/api/storage/'):]
                            logger.info(f"Extracted storage path from videoURL: {storage_path}")
                        else:
                            # Fallback: try to extract filename and construct path
                            path_parts = url_path.split('/')
                            filename = None
                            for part in reversed(path_parts):
                                if part and '.' in part:
                                    filename = part
                                    break
                            if filename and user_id:
                                # Construct path: videos/{uid}/{filename}
                                storage_path = f"videos/{user_id}/{filename}"
                                logger.info(f"Constructed storage path from videoURL: {storage_path}")
                    except Exception as e:
                        logger.warning(f"Error extracting path from videoURL: {e}")
                
                if not storage_path:
                    # Fallback: construct path from user_id and session_id
                    if user_id:
                        storage_path = f"videos/{user_id}/{session_id}.mp4"
                        logger.warning(f"Using fallback storage path: {storage_path}")
                    else:
                        return jsonify({
                            'error': 'Could not determine video path',
                            'message': 'Session does not contain videoPath or videoURL, and user_id is missing',
                            'ok': False
                        }), 400
                
                logger.info(f"Using storage path: {storage_path} (from session {session_id})")
                
            except Exception as db_error:
                logger.error(f'Database error getting session: {str(db_error)}', exc_info=True)
                return jsonify({
                    'error': 'Database error',
                    'message': 'Failed to retrieve session information',
                    'ok': False
                }), 500
        
        # If video_id was provided directly (not from session), construct storage path
        if final_video_id and not storage_path:
            if user_id:
                # Construct path: videos/{uid}/{video_id}
                storage_path = f"videos/{user_id}/{final_video_id}"
            else:
                return jsonify({
                    'error': 'User ID required',
                    'message': 'Cannot construct video path without user_id',
                    'ok': False
                }), 400
        
        if not storage_path:
            return jsonify({
                'error': 'video_id or session_id is required',
                'message': 'Please provide either video_id or session_id',
                'ok': False
            }), 400
        
        logger.info(f"Analyzing video at path: {storage_path} for user {user_id}")
        
        # Initialize services
        storage_client = StorageClient()
        frame_extractor = VideoFrameExtractor()
        claude_analyzer = ClaudeAnalyzer()
        
        # Fetch video from storage server using full storage path
        try:
            video_bytes = storage_client.fetch_video(storage_path)
            if not video_bytes:
                logger.error(f"Video not found at storage path: {storage_path}")
                return jsonify({
                    'error': 'Video not found',
                    'message': f'Video not found at path: {storage_path}. Please verify the video exists in storage.',
                    'ok': False
                }), 404
        except Exception as e:
            logger.error(f"Error fetching video from storage: {str(e)}", exc_info=True)
            return jsonify({
                'error': 'Storage server error',
                'message': f'Failed to fetch video from storage server: {str(e)}',
                'ok': False
            }), 500
        
        logger.info(f"Fetched video, size: {len(video_bytes)} bytes")
        
        # Extract frames (every 10th frame)
        try:
            frames = frame_extractor.extract_frames(video_bytes, sample_rate=10)
            if not frames:
                logger.error(f"Could not extract frames from video (size: {len(video_bytes)} bytes)")
                return jsonify({
                    'error': 'Frame extraction failed',
                    'message': 'Could not extract frames from video. The video file may be corrupted or in an unsupported format.',
                    'ok': False
                }), 400
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}", exc_info=True)
            return jsonify({
                'error': 'Frame extraction error',
                'message': f'Failed to extract frames from video: {str(e)}',
                'ok': False
            }), 500
        
        logger.info(f"Extracted {len(frames)} frames, analyzing with Claude...")
        
        # Analyze frames with Claude - use first 3 frames for speed
        logger.info(f"Analyzing {min(3, len(frames))} frames with Claude (using first 3 for speed)...")
        frame_analyses = []
        failed_frames = []
        
        # Only analyze first 3 frames to speed things up
        frames_to_analyze = frames[:3]
        
        for frame_idx, frame_base64 in frames_to_analyze:
            logger.info(f"Analyzing frame {frame_idx} with Claude...")
            try:
                analysis = claude_analyzer.analyze_frame(frame_base64, frame_idx)
                if analysis:
                    frame_analyses.append(analysis)
                    logger.info(f"Frame {frame_idx} analyzed successfully")
                else:
                    failed_frames.append(frame_idx)
                    logger.warning(f"Frame {frame_idx} analysis returned None")
            except Exception as e:
                failed_frames.append(frame_idx)
                logger.error(f"Frame {frame_idx} analysis exception: {str(e)}", exc_info=True)
        
        if not frame_analyses:
            error_msg = f'Failed to analyze any frames with Claude. Attempted {len(frames_to_analyze)} frames, all failed.'
            if failed_frames:
                error_msg += f' Failed frame indices: {failed_frames}.'
            error_msg += ' Check OpenRouter API key and network connection.'
            logger.error(error_msg)
            return jsonify({
                'error': 'Claude analysis failed',
                'message': error_msg,
                'ok': False,
                'details': {
                    'total_frames': len(frames),
                    'attempted_frames': len(frames_to_analyze),
                    'failed_frames': failed_frames,
                    'suggestion': 'Verify OPENROUTER_API_KEY is set correctly'
                }
            }), 500
        
        logger.info(f"Successfully analyzed {len(frame_analyses)}/{len(frames_to_analyze)} frames")
        
        # Generate recommendation from analyzed frames
        logger.info(f"Generating recommendation from {len(frame_analyses)} frame analyses...")
        recommendation = claude_analyzer.generate_recommendation(frame_analyses)
        
        logger.info(f"Recommendation generated: {recommendation[:100]}...")
        
        return jsonify({
            'ok': True,
            'recommendation': recommendation,
            'frameCount': len(frames),
            'framesAnalyzed': len(frame_analyses),
            'totalFrames': len(frames)
        })
    
    except Exception as e:
        logger.error(f'Claude video analysis error: {str(e)}', exc_info=True)
        error_message = str(e)
        # Provide more user-friendly error messages for common issues
        if 'MongoDB' in error_message or 'database' in error_message.lower():
            error_message = 'Database connection error. Please try again.'
        elif 'storage' in error_message.lower() or 'fetch' in error_message.lower():
            error_message = 'Failed to retrieve video from storage. Please verify the video exists.'
        elif 'OpenRouter' in error_message or 'API' in error_message:
            error_message = 'AI analysis service error. Please check API configuration.'
        
        return jsonify({
            'error': 'Internal server error',
            'message': error_message,
            'ok': False
        }), 500

