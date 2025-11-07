"""
Bat detection service for baseball swing analysis
Supports both YOLOv8 and MediaPipe-based detection
"""
import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple, List
from scipy import stats

logger = logging.getLogger(__name__)

class BatDetector:
    """Detects bat in video frames using YOLO or MediaPipe-based methods"""
    
    def __init__(self, use_yolo: bool = True, yolo_confidence: float = 0.5):
        """
        Initialize bat detector
        
        Args:
            use_yolo: Whether to use YOLOv8 for bat detection
            yolo_confidence: Confidence threshold for YOLO detection
        """
        self.use_yolo = use_yolo
        self.yolo_confidence = yolo_confidence
        self.yolo_model = None
        
        if use_yolo:
            try:
                from ultralytics import YOLO
                # Try to load a custom bat detection model, fallback to general YOLOv8
                try:
                    self.yolo_model = YOLO('yolov8n.pt')  # Start with nano model
                    logger.info("YOLOv8 model loaded for bat detection")
                except Exception as e:
                    logger.warning(f"Could not load YOLOv8 model: {e}. Falling back to MediaPipe-based detection.")
                    self.use_yolo = False
            except ImportError:
                logger.warning("ultralytics not available. Using MediaPipe-based detection.")
                self.use_yolo = False
    
    def detect_bat_yolo(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect bat using YOLOv8
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with bat detection results or None
        """
        if not self.yolo_model:
            return None
        
        try:
            # Run YOLO detection
            results = self.yolo_model(frame, conf=self.yolo_confidence, verbose=False)
            
            # Look for bat-like objects (long, thin objects)
            # Note: YOLOv8 doesn't have a "bat" class by default
            # This would need a custom trained model or we use general object detection
            # For now, we'll use MediaPipe-based detection as fallback
            # TODO: Train custom YOLOv8 model for bat detection
            
            # Check for "sports ball" or similar classes that might be near bat
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Filter for long, thin objects (potential bat)
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        width = x2 - x1
                        height = y2 - y1
                        aspect_ratio = width / height if height > 0 else 0
                        
                        # Bat is typically long and thin (aspect ratio > 3 or < 0.33)
                        if aspect_ratio > 3 or aspect_ratio < 0.33:
                            confidence = float(box.conf[0].cpu().numpy())
                            if confidence >= self.yolo_confidence:
                                return {
                                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                                    'confidence': confidence,
                                    'angle': self._calculate_angle_from_bbox(x1, y1, x2, y2),
                                    'method': 'yolo'
                                }
        except Exception as e:
            logger.error(f"YOLO bat detection error: {e}")
        
        return None
    
    def detect_bat_mediapipe(self, frame: np.ndarray, pose_landmarks: Optional[List] = None) -> Optional[Dict]:
        """
        Detect bat using MediaPipe pose landmarks and line fitting
        
        Args:
            frame: Input frame as numpy array
            pose_landmarks: MediaPipe pose landmarks (optional)
            
        Returns:
            Dictionary with bat detection results or None
        """
        try:
            # If pose landmarks provided, use wrist/elbow to estimate bat region
            if pose_landmarks:
                # Get hand region (wrist to elbow)
                # This is a simplified approach - in practice, you'd need more sophisticated detection
                hand_region = self._get_hand_region(pose_landmarks, frame.shape)
                if hand_region:
                    # Crop hand region
                    x1, y1, x2, y2 = hand_region
                    hand_crop = frame[y1:y2, x1:x2]
                    
                    # Detect lines in hand region using HoughLinesP
                    gray = cv2.cvtColor(hand_crop, cv2.COLOR_RGB2GRAY) if len(hand_crop.shape) == 3 else hand_crop
                    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
                    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=30, minLineLength=20, maxLineGap=10)
                    
                    if lines is not None and len(lines) > 0:
                        # Find longest line (likely the bat)
                        longest_line = max(lines, key=lambda l: np.sqrt((l[0][2]-l[0][0])**2 + (l[0][3]-l[0][1])**2))
                        x1_line, y1_line, x2_line, y2_line = longest_line[0]
                        
                        # Convert back to full frame coordinates
                        x1_abs = x1 + x1_line
                        y1_abs = y1 + y1_line
                        x2_abs = x1 + x2_line
                        y2_abs = y1 + y2_line
                        
                        angle = self._calculate_angle(x1_abs, y1_abs, x2_abs, y2_abs)
                        
                        return {
                            'bbox': [float(x1_abs), float(y1_abs), float(x2_abs), float(y2_abs)],
                            'confidence': 0.6,  # Medium confidence for MediaPipe method
                            'angle': angle,
                            'method': 'mediapipe'
                        }
            
            # Fallback: detect lines in full frame
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY) if len(frame.shape) == 3 else frame
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, minLineLength=30, maxLineGap=10)
            
            if lines is not None and len(lines) > 0:
                # Find longest line
                longest_line = max(lines, key=lambda l: np.sqrt((l[0][2]-l[0][0])**2 + (l[0][3]-l[0][1])**2))
                x1, y1, x2, y2 = longest_line[0]
                angle = self._calculate_angle(x1, y1, x2, y2)
                
                return {
                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                    'confidence': 0.5,
                    'angle': angle,
                    'method': 'hough'
                }
        
        except Exception as e:
            logger.error(f"MediaPipe bat detection error: {e}")
        
        return None
    
    def detect_bat(self, frame: np.ndarray, pose_landmarks: Optional[List] = None) -> Optional[Dict]:
        """
        Detect bat in frame using configured method
        
        Args:
            frame: Input frame as numpy array
            pose_landmarks: MediaPipe pose landmarks (optional)
            
        Returns:
            Dictionary with bat detection results or None
        """
        if self.use_yolo and self.yolo_model:
            result = self.detect_bat_yolo(frame)
            if result:
                return result
        
        # Fallback to MediaPipe-based detection
        return self.detect_bat_mediapipe(frame, pose_landmarks)
    
    def _get_hand_region(self, landmarks: List, frame_shape: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
        """Extract hand region from pose landmarks"""
        try:
            h, w = frame_shape[:2]
            
            # MediaPipe landmark indices (approximate - adjust based on actual MediaPipe structure)
            # This is a simplified version - you'd need actual MediaPipe landmark structure
            wrist_x = landmarks[15].x * w if hasattr(landmarks[15], 'x') else None
            wrist_y = landmarks[15].y * h if hasattr(landmarks[15], 'y') else None
            elbow_x = landmarks[13].x * w if hasattr(landmarks[13], 'x') else None
            elbow_y = landmarks[13].y * h if hasattr(landmarks[13], 'y') else None
            
            if wrist_x and wrist_y and elbow_x and elbow_y:
                # Expand region around hand
                margin = 50
                x1 = max(0, int(min(wrist_x, elbow_x) - margin))
                y1 = max(0, int(min(wrist_y, elbow_y) - margin))
                x2 = min(w, int(max(wrist_x, elbow_x) + margin))
                y2 = min(h, int(max(wrist_y, elbow_y) + margin))
                
                return (x1, y1, x2, y2)
        except Exception as e:
            logger.debug(f"Error extracting hand region: {e}")
        
        return None
    
    def _calculate_angle(self, x1: float, y1: float, x2: float, y2: float) -> float:
        """Calculate angle of line in degrees"""
        dx = x2 - x1
        dy = y2 - y1
        angle = np.degrees(np.arctan2(dy, dx))
        return angle
    
    def _calculate_angle_from_bbox(self, x1: float, y1: float, x2: float, y2: float) -> float:
        """Calculate angle from bounding box"""
        return self._calculate_angle(x1, y1, x2, y2)

