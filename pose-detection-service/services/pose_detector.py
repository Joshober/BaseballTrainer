"""
Pose detection service using MediaPipe Pose
Provides baseball swing analysis metrics
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple

# Try to import mediapipe, but make it optional
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    mp = None
    logging.warning("MediaPipe not available. Pose detection will be disabled. Install mediapipe or use Python 3.11 or 3.12.")

# Try to import cv2, but make it optional
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logging.warning("OpenCV not available. Some image processing features may be limited.")

logger = logging.getLogger(__name__)

class PoseDetector:
    """MediaPipe-based pose detector for baseball swing analysis"""
    
    def __init__(self):
        """Initialize MediaPipe Pose detector"""
        if not MEDIAPIPE_AVAILABLE:
            self.mp_pose = None
            self.mp_drawing = None
            self.pose = None
            logger.warning("MediaPipe not available. Pose detection disabled.")
            return
        
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,  # Use full model for better accuracy
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        logger.info("MediaPipe Pose detector initialized")
    
    def detect_pose(self, image: np.ndarray) -> Dict:
        """
        Detect pose from image and calculate baseball swing metrics
        
        Args:
            image: RGB image as numpy array
            
        Returns:
            Dictionary with pose detection results and swing metrics
        """
        if not MEDIAPIPE_AVAILABLE or self.pose is None:
            return {
                'ok': False,
                'error': 'MediaPipe not available',
                'message': 'MediaPipe is not installed. Please install mediapipe or use Python 3.11 or 3.12. Pose detection is disabled.'
            }
        
        try:
            # Convert BGR to RGB if needed (MediaPipe expects RGB)
            if len(image.shape) == 3 and image.shape[2] == 3:
                # Check if it's BGR (OpenCV format) and convert if needed
                if CV2_AVAILABLE and image.dtype == np.uint8:
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                else:
                    # Assume RGB if OpenCV not available
                    image_rgb = image
            else:
                image_rgb = image
            
            # Run pose detection
            results = self.pose.process(image_rgb)
            
            if not results.pose_landmarks:
                return {'ok': False, 'message': 'No pose detected'}
            
            # Extract landmarks
            landmarks = results.pose_landmarks.landmark
            
            # Calculate metrics
            metrics = self._calculate_swing_metrics(landmarks, image_rgb.shape)
            
            # Convert landmarks to list format for serialization
            landmarks_list = [
                {
                    'x': lm.x,
                    'y': lm.y,
                    'z': lm.z,
                    'visibility': lm.visibility
                }
                for lm in landmarks
            ]
            
            return {
                'ok': True,
                'landmarks': landmarks_list,
                **metrics
            }
        
        except Exception as e:
            logger.error(f"Error in pose detection: {str(e)}", exc_info=True)
            return {'ok': False, 'error': str(e)}
    
    def _calculate_swing_metrics(self, landmarks: List, image_shape: Tuple[int, int, int]) -> Dict:
        """
        Calculate baseball swing metrics from pose landmarks
        
        Args:
            landmarks: MediaPipe pose landmarks
            image_shape: (height, width, channels) of the image
            
        Returns:
            Dictionary with swing metrics
        """
        h, w = image_shape[:2]
        
        # Helper function to get landmark coordinates
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
                'left_knee': self.mp_pose.PoseLandmark.LEFT_KNEE,
                'right_knee': self.mp_pose.PoseLandmark.RIGHT_KNEE,
                'left_ankle': self.mp_pose.PoseLandmark.LEFT_ANKLE,
                'right_ankle': self.mp_pose.PoseLandmark.RIGHT_ANKLE,
                'nose': self.mp_pose.PoseLandmark.NOSE,
            }
            
            if name not in landmark_map:
                return None
            
            landmark_idx = landmark_map[name]
            if landmark_idx >= len(landmarks):
                return None
            
            lm = landmarks[landmark_idx]
            return (lm.x * w, lm.y * h)
        
        # Calculate shoulder angle (torso rotation)
        left_shoulder = get_landmark('left_shoulder')
        right_shoulder = get_landmark('right_shoulder')
        shoulder_angle = None
        
        if left_shoulder and right_shoulder:
            dx = right_shoulder[0] - left_shoulder[0]
            dy = right_shoulder[1] - left_shoulder[1]
            shoulder_angle = np.degrees(np.arctan2(dy, dx))
        
        # Calculate hand/arm angle (bat path proxy)
        # Try right side first (typical for right-handed batters)
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
        
        # Calculate hip rotation
        left_hip = get_landmark('left_hip')
        right_hip = get_landmark('right_hip')
        hip_angle = None
        
        if left_hip and right_hip:
            dx = right_hip[0] - left_hip[0]
            dy = right_hip[1] - left_hip[1]
            hip_angle = np.degrees(np.arctan2(dy, dx))
        
        # Calculate launch angle estimate (combination of shoulder and hand angles)
        launch_angle = None
        if shoulder_angle is not None and hand_angle is not None:
            # Weighted average favoring hand angle (bat path)
            launch_angle = (hand_angle * 0.7 + shoulder_angle * 0.3)
        
        # Calculate confidence (based on number of detected landmarks)
        detected_landmarks = sum([
            left_shoulder is not None, right_shoulder is not None,
            left_elbow is not None, right_elbow is not None,
            left_wrist is not None, right_wrist is not None,
            left_hip is not None, right_hip is not None,
        ])
        confidence = detected_landmarks / 8.0
        
        return {
            'shoulderAngle': shoulder_angle,
            'handAngle': hand_angle,
            'hipAngle': hip_angle,
            'launchAngle': launch_angle,
            'confidence': confidence,
            'detectedLandmarks': detected_landmarks,
        }
    
    def __del__(self):
        """Cleanup"""
        if hasattr(self, 'pose'):
            self.pose.close()

