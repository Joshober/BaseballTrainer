"""
Ball detection service for baseball swing analysis
Supports both YOLOv8 and blob-based detection with Kalman Filter tracking
"""
import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple, List

logger = logging.getLogger(__name__)

class BallTracker:
    """Tracks ball using Kalman Filter for prediction"""
    
    def __init__(self):
        """Initialize Kalman Filter for ball tracking"""
        # Simple Kalman Filter implementation
        # State: [x, y, vx, vy] (position and velocity)
        self.kf = cv2.KalmanFilter(4, 2)
        
        # Transition matrix (constant velocity model)
        self.kf.transitionMatrix = np.array([
            [1, 0, 1, 0],  # x' = x + vx
            [0, 1, 0, 1],  # y' = y + vy
            [0, 0, 1, 0],  # vx' = vx
            [0, 0, 0, 1]   # vy' = vy
        ], dtype=np.float32)
        
        # Measurement matrix (we only observe position)
        self.kf.measurementMatrix = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)
        
        # Process noise covariance
        self.kf.processNoiseCov = np.eye(4, dtype=np.float32) * 0.03
        
        # Measurement noise covariance
        self.kf.measurementNoiseCov = np.eye(2, dtype=np.float32) * 0.1
        
        # Error covariance
        self.kf.errorCovPost = np.eye(4, dtype=np.float32)
        
        self.initialized = False
    
    def update(self, measurement: Optional[Tuple[float, float]]) -> Optional[Tuple[float, float]]:
        """
        Update Kalman Filter with new measurement
        
        Args:
            measurement: (x, y) position or None if not detected
            
        Returns:
            Predicted (x, y) position
        """
        if measurement is None:
            # No measurement, just predict
            if self.initialized:
                prediction = self.kf.predict()
                return (float(prediction[0]), float(prediction[1]))
            return None
        
        x, y = measurement
        
        if not self.initialized:
            # Initialize with first measurement
            self.kf.statePre = np.array([x, y, 0, 0], dtype=np.float32)
            self.kf.statePost = np.array([x, y, 0, 0], dtype=np.float32)
            self.initialized = True
            return (x, y)
        
        # Predict
        prediction = self.kf.predict()
        
        # Update with measurement
        measurement_array = np.array([[x], [y]], dtype=np.float32)
        self.kf.correct(measurement_array)
        
        # Return corrected state
        state = self.kf.statePost
        return (float(state[0]), float(state[1]))
    
    def predict(self) -> Optional[Tuple[float, float]]:
        """
        Predict next position without measurement
        
        Returns:
            Predicted (x, y) position
        """
        if not self.initialized:
            return None
        
        prediction = self.kf.predict()
        return (float(prediction[0]), float(prediction[1]))
    
    def get_velocity(self) -> Optional[Tuple[float, float]]:
        """
        Get current velocity estimate
        
        Returns:
            (vx, vy) velocity or None
        """
        if not self.initialized:
            return None
        
        state = self.kf.statePost
        return (float(state[2]), float(state[3]))

class BallDetector:
    """Detects baseball in video frames using YOLO or blob detection with Kalman Filter tracking"""
    
    def __init__(self, use_yolo: bool = True, yolo_confidence: float = 0.5, 
                 enable_tracking: bool = True, use_advanced_tracking: bool = True):
        """
        Initialize ball detector
        
        Args:
            use_yolo: Whether to use YOLOv8 for ball detection
            yolo_confidence: Confidence threshold for YOLO detection
            enable_tracking: Whether to enable Kalman Filter tracking
            use_advanced_tracking: Whether to use advanced tracking (Kalman Filter + IoU matching)
        """
        self.use_yolo = use_yolo
        self.yolo_confidence = yolo_confidence
        self.yolo_model = None
        self.enable_tracking = enable_tracking
        self.use_advanced_tracking = use_advanced_tracking
        
        # Use advanced tracker if enabled, otherwise use simple tracker
        if enable_tracking:
            if use_advanced_tracking:
                try:
                    from services.object_tracker import BallTrackerAdvanced
                    self.advanced_tracker = BallTrackerAdvanced(use_kalman=True)
                    self.tracker = None  # Use advanced tracker
                    logger.info("Using advanced ball tracking with Kalman Filter")
                except Exception as e:
                    logger.warning(f"Could not initialize advanced tracker: {e}. Using simple tracker.")
                    self.advanced_tracker = None
                    self.tracker = BallTracker()
            else:
                self.advanced_tracker = None
                self.tracker = BallTracker()
        else:
            self.advanced_tracker = None
            self.tracker = None
        
        if use_yolo:
            try:
                from services.yolo_cache import get_yolo_model
                self.yolo_model = get_yolo_model()
                if self.yolo_model:
                    logger.info("YOLOv8 model loaded for ball detection (from cache)")
                else:
                    logger.warning("Could not load YOLOv8 model. Falling back to blob detection.")
                    self.use_yolo = False
            except ImportError:
                logger.warning("ultralytics not available. Using blob-based detection.")
                self.use_yolo = False
        
        # Initialize blob detector for fallback
        self.blob_detector = self._create_blob_detector()
    
    def _create_blob_detector(self) -> cv2.SimpleBlobDetector:
        """Create blob detector for baseball detection with optimized parameters"""
        params = cv2.SimpleBlobDetector_Params()
        
        # Filter by color (white baseball) - more flexible
        params.filterByColor = True
        params.blobColor = 255
        
        # Filter by area - optimized for baseball sizes at different distances
        params.filterByArea = True
        params.minArea = 5  # Smaller minimum for distant balls
        params.maxArea = 8000  # Larger maximum for close balls
        
        # Filter by circularity - baseball is very circular
        params.filterByCircularity = True
        params.minCircularity = 0.6  # Increased from 0.5 for better filtering
        
        # Filter by convexity
        params.filterByConvexity = True
        params.minConvexity = 0.6  # Increased from 0.5
        
        # Filter by inertia (ratio of minimum to maximum inertia)
        params.filterByInertia = True
        params.minInertiaRatio = 0.4  # Increased from 0.3
        
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
            # Optimize: Resize frame for faster YOLO processing (max 640px width)
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                new_h = int(h * scale)
                resized_frame = cv2.resize(frame, (640, new_h), interpolation=cv2.INTER_LINEAR)
            else:
                resized_frame = frame
                scale = 1.0
            
            # Run YOLO detection on resized frame
            results = self.yolo_model(resized_frame, conf=self.yolo_confidence, verbose=False, imgsz=640)
            
            # Use original frame dimensions for coordinate scaling
            resized_h, resized_w = resized_frame.shape[:2]
            scale_x = w / resized_w
            scale_y = h / resized_h
            
            # Look for "sports ball" class (class 32 in COCO dataset)
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls = int(box.cls[0].cpu().numpy())
                        # COCO class 32 is "sports ball"
                        if cls == 32:
                            # Scale coordinates back to original frame size
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            x1 = x1 * scale_x
                            y1 = y1 * scale_y
                            x2 = x2 * scale_x
                            y2 = y2 * scale_y
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
    
    def detect_ball_blob(self, frame: np.ndarray, scale: float = 1.0) -> Optional[Dict]:
        """
        Detect ball using blob detection with multi-scale support
        
        Args:
            frame: Input frame as numpy array
            scale: Scale factor for multi-scale detection (1.0 = original)
            
        Returns:
            Dictionary with ball detection results or None
        """
        try:
            # Resize frame if scale != 1.0
            if scale != 1.0:
                h, w = frame.shape[:2]
                new_h, new_w = int(h * scale), int(w * scale)
                scaled_frame = cv2.resize(frame, (new_w, new_h))
            else:
                scaled_frame = frame
            
            # Convert to grayscale if needed
            if len(scaled_frame.shape) == 3:
                gray = cv2.cvtColor(scaled_frame, cv2.COLOR_RGB2GRAY)
            else:
                gray = scaled_frame
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (9, 9), 2)
            
            # Detect blobs
            keypoints = self.blob_detector.detect(blurred)
            
            if keypoints:
                # Filter and score keypoints
                candidates = []
                for kp in keypoints:
                    x = kp.pt[0] / scale  # Convert back to original scale
                    y = kp.pt[1] / scale
                    radius = kp.size / (2 * scale)
                    
                    # Score based on size (prefer reasonable sizes)
                    size_score = 1.0
                    if radius < 5 or radius > 50:
                        size_score = 0.5  # Penalize very small or very large
                    
                    # Score based on circularity (from keypoint response)
                    response_score = kp.response if hasattr(kp, 'response') else 1.0
                    
                    total_score = size_score * response_score
                    
                    candidates.append({
                        'x': x,
                        'y': y,
                        'radius': radius,
                        'score': total_score
                    })
                
                if candidates:
                    # Get best candidate
                    best = max(candidates, key=lambda c: c['score'])
                    
                    return {
                        'bbox': [
                            float(best['x'] - best['radius']),
                            float(best['y'] - best['radius']),
                            float(best['x'] + best['radius']),
                            float(best['y'] + best['radius'])
                        ],
                        'center': [best['x'], best['y']],
                        'radius': best['radius'],
                        'confidence': min(0.7, 0.5 + best['score'] * 0.2),
                        'method': 'blob'
                    }
        except Exception as e:
            logger.error(f"Blob ball detection error: {e}")
        
        return None
    
    def _detect_ball_multi_scale(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect ball using multi-scale blob detection
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with ball detection results or None
        """
        scales = [1.0, 0.75, 1.25]  # Try different scales
        best_detection = None
        best_confidence = 0.0
        
        for scale in scales:
            detection = self.detect_ball_blob(frame, scale=scale)
            if detection and detection['confidence'] > best_confidence:
                best_confidence = detection['confidence']
                best_detection = detection
        
        return best_detection
    
    def _filter_false_positives(self, detection: Dict, frame: np.ndarray) -> bool:
        """
        Filter false positives using color and shape characteristics
        
        Args:
            detection: Detection result dictionary
            frame: Original frame
            
        Returns:
            True if detection is valid, False if false positive
        """
        try:
            bbox = detection['bbox']
            x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
            
            # Ensure bbox is within frame
            h, w = frame.shape[:2]
            x1 = max(0, min(x1, w))
            y1 = max(0, min(y1, h))
            x2 = max(0, min(x2, w))
            y2 = max(0, min(y2, h))
            
            if x2 <= x1 or y2 <= y1:
                return False
            
            # Extract region
            region = frame[y1:y2, x1:x2]
            if region.size == 0:
                return False
            
            # Check color characteristics (baseball is white/light colored)
            if len(region.shape) == 3:
                # Convert to grayscale
                gray_region = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
            else:
                gray_region = region
            
            # Check if region has high brightness (white baseball)
            mean_brightness = np.mean(gray_region)
            if mean_brightness < 100:  # Too dark for white baseball
                return False
            
            # Check circularity by examining edges
            edges = cv2.Canny(gray_region, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Find largest contour
                largest_contour = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(largest_contour)
                perimeter = cv2.arcLength(largest_contour, True)
                
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    if circularity < 0.5:  # Not circular enough
                        return False
            
            return True
        
        except Exception as e:
            logger.debug(f"False positive filtering error: {e}")
            return True  # If filtering fails, accept detection
    
    def detect_ball(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect ball in frame using configured method with multi-scale and filtering
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary with ball detection results or None
        """
        detection = None
        
        # Try YOLO first
        if self.use_yolo and self.yolo_model:
            detection = self.detect_ball_yolo(frame)
        
        # Fallback to multi-scale blob detection
        if not detection:
            detection = self._detect_ball_multi_scale(frame)
        
        # Filter false positives
        if detection and not self._filter_false_positives(detection, frame):
            detection = None
        
        return detection
    
    def track_ball(self, prev_position: Optional[Tuple[float, float]], 
                   current_detection: Optional[Dict]) -> Optional[Dict]:
        """
        Track ball across frames using advanced or simple tracking
        
        Args:
            prev_position: Previous ball position (x, y) - deprecated, using advanced tracking instead
            current_detection: Current frame detection result
            
        Returns:
            Updated detection with tracking info
        """
        if not self.enable_tracking:
            return current_detection
        
        # Use advanced tracker if available
        if self.use_advanced_tracking and self.advanced_tracker:
            tracked = self.advanced_tracker.update(current_detection)
            if tracked:
                # Add velocity if we can calculate it
                if 'center' in tracked:
                    # Try to get velocity from tracker's Kalman Filter
                    track = self.advanced_tracker.tracker.get_track_by_id(tracked.get('track_id'))
                    if track and track.kalman_filter:
                        state = track.kalman_filter.statePost
                        if len(state) >= 6:
                            vx, vy = float(state[4]), float(state[5])
                            speed = np.sqrt(vx**2 + vy**2)
                            tracked['velocity'] = float(speed)
                            tracked['velocity_vector'] = [vx, vy]
                    tracked['tracked'] = True
                return tracked
            return current_detection
        
        # Fallback to simple Kalman Filter tracker
        if self.tracker:
            if current_detection:
                center = current_detection['center']
                measurement = (center[0], center[1])
            else:
                measurement = None
            
            # Update Kalman Filter
            tracked_position = self.tracker.update(measurement)
            
            if tracked_position:
                # Update detection with tracked position and velocity
                if current_detection:
                    current_detection['center'] = [tracked_position[0], tracked_position[1]]
                    current_detection['tracked'] = True
                    
                    # Get velocity from Kalman Filter
                    velocity = self.tracker.get_velocity()
                    if velocity:
                        speed = np.sqrt(velocity[0]**2 + velocity[1]**2)
                        current_detection['velocity'] = float(speed)
                        current_detection['velocity_vector'] = [float(velocity[0]), float(velocity[1])]
                    else:
                        current_detection['velocity'] = 0.0
                else:
                    # No detection but we have prediction
                    predicted = self.tracker.predict()
                    if predicted:
                        radius = 10
                        current_detection = {
                            'bbox': [
                                float(predicted[0] - radius),
                                float(predicted[1] - radius),
                                float(predicted[0] + radius),
                                float(predicted[1] + radius)
                            ],
                            'center': [predicted[0], predicted[1]],
                            'radius': float(radius),
                            'confidence': 0.3,
                            'method': 'kalman_prediction',
                            'tracked': True
                        }
                        
                        velocity = self.tracker.get_velocity()
                        if velocity:
                            speed = np.sqrt(velocity[0]**2 + velocity[1]**2)
                            current_detection['velocity'] = float(speed)
                            current_detection['velocity_vector'] = [float(velocity[0]), float(velocity[1])]
        
        return current_detection

