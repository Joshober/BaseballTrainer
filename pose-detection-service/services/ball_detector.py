"""
Ball detection service for baseball swing analysis
Supports both YOLOv8 and blob-based detection
"""
import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple, List

logger = logging.getLogger(__name__)

class BallDetector:
    """Detects baseball in video frames using YOLO or blob detection"""
    
    def __init__(self, use_yolo: bool = True, yolo_confidence: float = 0.5):
        """
        Initialize ball detector
        
        Args:
            use_yolo: Whether to use YOLOv8 for ball detection
            yolo_confidence: Confidence threshold for YOLO detection
        """
        self.use_yolo = use_yolo
        self.yolo_confidence = yolo_confidence
        self.yolo_model = None
        
        if use_yolo:
            try:
                from ultralytics import YOLO
                try:
                    self.yolo_model = YOLO('yolov8n.pt')
                    logger.info("YOLOv8 model loaded for ball detection")
                except Exception as e:
                    logger.warning(f"Could not load YOLOv8 model: {e}. Falling back to blob detection.")
                    self.use_yolo = False
            except ImportError:
                logger.warning("ultralytics not available. Using blob-based detection.")
                self.use_yolo = False
        
        # Initialize blob detector for fallback
        self.blob_detector = self._create_blob_detector()
    
    def _create_blob_detector(self) -> cv2.SimpleBlobDetector:
        """Create blob detector for baseball detection"""
        params = cv2.SimpleBlobDetector_Params()
        
        # Filter by color (white baseball)
        params.filterByColor = True
        params.blobColor = 255
        
        # Filter by area
        params.filterByArea = True
        params.minArea = 10
        params.maxArea = 5000
        
        # Filter by circularity
        params.filterByCircularity = True
        params.minCircularity = 0.5
        
        # Filter by convexity
        params.filterByConvexity = True
        params.minConvexity = 0.5
        
        # Filter by inertia
        params.filterByInertia = True
        params.minInertiaRatio = 0.3
        
        return cv2.SimpleBlobDetector_create(params)
    
    def detect_ball_yolo(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect ball using YOLOv8
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with ball detection results or None
        """
        if not self.yolo_model:
            return None
        
        try:
            # Run YOLO detection
            results = self.yolo_model(frame, conf=self.yolo_confidence, verbose=False)
            
            # Look for "sports ball" class (class 32 in COCO dataset)
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls = int(box.cls[0].cpu().numpy())
                        # COCO class 32 is "sports ball"
                        if cls == 32:
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            confidence = float(box.conf[0].cpu().numpy())
                            
                            if confidence >= self.yolo_confidence:
                                center_x = (x1 + x2) / 2
                                center_y = (y1 + y2) / 2
                                radius = max((x2 - x1), (y2 - y1)) / 2
                                
                                return {
                                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                                    'center': [float(center_x), float(center_y)],
                                    'radius': float(radius),
                                    'confidence': confidence,
                                    'method': 'yolo'
                                }
        except Exception as e:
            logger.error(f"YOLO ball detection error: {e}")
        
        return None
    
    def detect_ball_blob(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect ball using blob detection
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with ball detection results or None
        """
        try:
            # Convert to grayscale if needed
            if len(frame.shape) == 3:
                gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            else:
                gray = frame
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (9, 9), 2)
            
            # Detect blobs
            keypoints = self.blob_detector.detect(blurred)
            
            if keypoints:
                # Get largest blob (likely the ball)
                largest_kp = max(keypoints, key=lambda kp: kp.size)
                
                x = float(largest_kp.pt[0])
                y = float(largest_kp.pt[1])
                radius = float(largest_kp.size / 2)
                
                return {
                    'bbox': [
                        float(x - radius),
                        float(y - radius),
                        float(x + radius),
                        float(y + radius)
                    ],
                    'center': [x, y],
                    'radius': radius,
                    'confidence': 0.6,  # Medium confidence for blob method
                    'method': 'blob'
                }
        except Exception as e:
            logger.error(f"Blob ball detection error: {e}")
        
        return None
    
    def detect_ball(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect ball in frame using configured method
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with ball detection results or None
        """
        if self.use_yolo and self.yolo_model:
            result = self.detect_ball_yolo(frame)
            if result:
                return result
        
        # Fallback to blob detection
        return self.detect_ball_blob(frame)
    
    def track_ball(self, prev_position: Optional[Tuple[float, float]], 
                   current_detection: Optional[Dict]) -> Optional[Dict]:
        """
        Track ball across frames using optical flow or position continuity
        
        Args:
            prev_position: Previous ball position (x, y)
            current_detection: Current frame detection result
            
        Returns:
            Updated detection with tracking info
        """
        if not current_detection:
            return None
        
        if prev_position:
            # Calculate distance from previous position
            current_center = current_detection['center']
            distance = np.sqrt(
                (current_center[0] - prev_position[0])**2 + 
                (current_center[1] - prev_position[1])**2
            )
            
            # Add velocity estimate (pixels per frame)
            current_detection['velocity'] = distance
            current_detection['tracked'] = True
        else:
            current_detection['velocity'] = 0.0
            current_detection['tracked'] = False
        
        return current_detection

