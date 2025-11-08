"""
Bat detection service for baseball swing analysis
Supports both YOLOv8 and MediaPipe-based detection
"""
import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple, List
from scipy import stats
from scipy.spatial.distance import cdist

logger = logging.getLogger(__name__)

class BatTracker:
    """Tracks bat position across frames"""
    
    def __init__(self, max_history: int = 5, position_threshold: float = 100.0):
        """
        Initialize bat tracker
        
        Args:
            max_history: Maximum number of previous positions to track
            position_threshold: Maximum distance for valid tracking (pixels)
        """
        self.max_history = max_history
        self.position_threshold = position_threshold
        self.history: List[Optional[Dict]] = []
    
    def update(self, detection: Optional[Dict]) -> Optional[Dict]:
        """
        Update tracker with new detection
        
        Args:
            detection: Current frame bat detection or None
            
        Returns:
            Detection with tracking info or None
        """
        if detection:
            # Add to history
            self.history.append(detection)
            if len(self.history) > self.max_history:
                self.history.pop(0)
            
            # Calculate velocity if we have previous detection
            if len(self.history) > 1 and self.history[-2]:
                prev = self.history[-2]
                curr_center = self._get_center(detection)
                prev_center = self._get_center(prev)
                
                if curr_center and prev_center:
                    dx = curr_center[0] - prev_center[0]
                    dy = curr_center[1] - prev_center[1]
                    velocity = np.sqrt(dx**2 + dy**2)
                    detection['velocity'] = float(velocity)
                    detection['tracked'] = True
        else:
            # No detection, but keep history
            self.history.append(None)
            if len(self.history) > self.max_history:
                self.history.pop(0)
        
        return detection
    
    def predict_position(self) -> Optional[Tuple[float, float]]:
        """
        Predict next bat position based on history
        
        Returns:
            Predicted (x, y) position or None
        """
        valid_detections = [d for d in self.history if d is not None]
        if len(valid_detections) < 2:
            return None
        
        # Simple linear prediction
        recent = valid_detections[-2:]
        centers = [self._get_center(d) for d in recent]
        if all(c for c in centers):
            dx = centers[1][0] - centers[0][0]
            dy = centers[1][1] - centers[0][1]
            predicted = (centers[1][0] + dx, centers[1][1] + dy)
            return predicted
        
        return None
    
    def _get_center(self, detection: Dict) -> Optional[Tuple[float, float]]:
        """Get center point from detection"""
        bbox = detection.get('bbox')
        if bbox:
            return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
        return None

class BatDetector:
    """Detects bat in video frames using YOLO or MediaPipe-based methods"""
    
    def __init__(self, use_yolo: bool = True, yolo_confidence: float = 0.5, 
                 enable_tracking: bool = True, use_advanced_tracking: bool = True):
        """
        Initialize bat detector
        
        Args:
            use_yolo: Whether to use YOLOv8 for bat detection
            yolo_confidence: Confidence threshold for YOLO detection
            enable_tracking: Whether to enable temporal tracking
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
                    from services.object_tracker import BatTrackerAdvanced
                    self.advanced_tracker = BatTrackerAdvanced(use_kalman=True)
                    self.tracker = None  # Use advanced tracker
                    logger.info("Using advanced bat tracking with Kalman Filter")
                except Exception as e:
                    logger.warning(f"Could not initialize advanced tracker: {e}. Using simple tracker.")
                    self.advanced_tracker = None
                    self.tracker = BatTracker()
            else:
                self.advanced_tracker = None
                self.tracker = BatTracker()
        else:
            self.advanced_tracker = None
            self.tracker = None
        
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
        Detect bat using YOLOv8 with improved filtering
        
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
            
            h, w = frame.shape[:2]
            candidates = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        width = x2 - x1
                        height = y2 - y1
                        aspect_ratio = width / height if height > 0 else 0
                        area = width * height
                        frame_area = w * h
                        area_ratio = area / frame_area
                        
                        # Improved filtering for bat-like objects
                        # Bat characteristics: long and thin, reasonable size
                        is_long_thin = (aspect_ratio > 2.5 or aspect_ratio < 0.4)
                        is_reasonable_size = (0.001 < area_ratio < 0.1)  # Not too small or too large
                        min_length = min(width, height) > 20  # Minimum dimension
                        
                        if is_long_thin and is_reasonable_size and min_length:
                            confidence = float(box.conf[0].cpu().numpy())
                            if confidence >= self.yolo_confidence:
                                # Score candidate (prefer longer, more centered objects)
                                center_x = (x1 + x2) / 2
                                center_y = (y1 + y2) / 2
                                distance_from_center = np.sqrt(
                                    (center_x - w/2)**2 + (center_y - h/2)**2
                                )
                                score = confidence * (1.0 - distance_from_center / (w + h))
                                
                                candidates.append({
                                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                                    'confidence': confidence,
                                    'angle': self._calculate_angle_from_bbox(x1, y1, x2, y2),
                                    'method': 'yolo',
                                    'score': score
                                })
            
            # Return best candidate
            if candidates:
                best = max(candidates, key=lambda c: c['score'])
                del best['score']  # Remove score from result
                return best
                
        except Exception as e:
            logger.error(f"YOLO bat detection error: {e}")
        
        return None
    
    def detect_bat_from_pose(self, frame: np.ndarray, pose_landmarks: Optional[List] = None) -> Optional[Dict]:
        """
        Detect bat using pose landmarks (wrist to elbow line as bat approximation)
        This is a fallback when YOLO doesn't detect the bat
        
        Args:
            frame: Input frame as numpy array
            pose_landmarks: MediaPipe pose landmarks (list of dicts with x, y, z, visibility)
            
        Returns:
            Dictionary with bat detection results or None
        """
        if not pose_landmarks:
            return None
        
        try:
            h, w = frame.shape[:2]
            
            # Get wrist and elbow positions (try both hands)
            # MediaPipe landmarks: LEFT_WRIST=15, LEFT_ELBOW=13, RIGHT_WRIST=16, RIGHT_ELBOW=14
            wrist_positions = []
            elbow_positions = []
            
            # Try to extract wrist and elbow from landmarks
            if isinstance(pose_landmarks, list) and len(pose_landmarks) > 15:
                # Check if it's a list of dicts (from PoseDetector output)
                if isinstance(pose_landmarks[15], dict):
                    left_wrist = (pose_landmarks[15]['x'] * w, pose_landmarks[15]['y'] * h)
                    left_elbow = (pose_landmarks[13]['x'] * w, pose_landmarks[13]['y'] * h)
                    wrist_positions.append(left_wrist)
                    elbow_positions.append(left_elbow)
                
                if len(pose_landmarks) > 16 and isinstance(pose_landmarks[16], dict):
                    right_wrist = (pose_landmarks[16]['x'] * w, pose_landmarks[16]['y'] * h)
                    right_elbow = (pose_landmarks[14]['x'] * w, pose_landmarks[14]['y'] * h)
                    wrist_positions.append(right_wrist)
                    elbow_positions.append(right_elbow)
            
            # Use the wrist that's higher (typically the top hand on bat)
            if wrist_positions:
                top_wrist = min(wrist_positions, key=lambda p: p[1])  # Min y = top
                corresponding_elbow = elbow_positions[wrist_positions.index(top_wrist)]
                
                # Estimate bat region: extend from wrist in direction away from elbow
                wrist_x, wrist_y = top_wrist
                elbow_x, elbow_y = corresponding_elbow
                
                # Direction vector from elbow to wrist
                dx = wrist_x - elbow_x
                dy = wrist_y - elbow_y
                length = np.sqrt(dx**2 + dy**2)
                
                if length > 0:
                    # Normalize and extend (bat is typically 0.8-1.0m, estimate ~100-150 pixels)
                    bat_length = 120  # Estimated bat length in pixels
                    unit_x = dx / length
                    unit_y = dy / length
                    
                    # Bat extends from wrist in direction away from elbow
                    bat_end_x = wrist_x + unit_x * bat_length
                    bat_end_y = wrist_y + unit_y * bat_length
                    
                    # Create bbox around bat line
                    margin = 10
                    x1 = int(min(wrist_x, bat_end_x) - margin)
                    y1 = int(min(wrist_y, bat_end_y) - margin)
                    x2 = int(max(wrist_x, bat_end_x) + margin)
                    y2 = int(max(wrist_y, bat_end_y) + margin)
                    
                    angle = self._calculate_angle(wrist_x, wrist_y, bat_end_x, bat_end_y)
                    
                    return {
                        'bbox': [float(x1), float(y1), float(x2), float(y2)],
                        'confidence': 0.7,  # Good confidence for pose-based method
                        'angle': angle,
                        'method': 'pose_landmarks'
                    }
        
        except Exception as e:
            logger.debug(f"Pose-based bat detection error: {e}")
        
        return None
    
    def _detect_bat_lines_ransac(self, frame: np.ndarray, region: Optional[Tuple[int, int, int, int]] = None) -> Optional[Dict]:
        """
        Detect bat using RANSAC for robust line fitting
        
        Args:
            frame: Input frame as numpy array
            region: Optional region (x1, y1, x2, y2) to search in
            
        Returns:
            Dictionary with bat detection results or None
        """
        try:
            # Crop to region if provided
            search_frame = frame
            offset_x, offset_y = 0, 0
            if region:
                x1, y1, x2, y2 = region
                search_frame = frame[y1:y2, x1:x2]
                offset_x, offset_y = x1, y1
            
            # Convert to grayscale
            gray = cv2.cvtColor(search_frame, cv2.COLOR_RGB2GRAY) if len(search_frame.shape) == 3 else search_frame
            
            # Edge detection with adaptive parameters
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            
            # Get edge points
            edge_points = np.column_stack(np.where(edges > 0))
            if len(edge_points) < 10:
                return None
            
            # Convert to (x, y) format
            edge_points_xy = edge_points[:, [1, 0]].astype(np.float32)
            
            # Use RANSAC to find best line
            # Simple RANSAC implementation
            best_line = None
            best_inliers = 0
            max_iterations = 100
            distance_threshold = 5.0
            
            for _ in range(max_iterations):
                # Randomly sample 2 points
                if len(edge_points_xy) < 2:
                    break
                sample_idx = np.random.choice(len(edge_points_xy), 2, replace=False)
                p1, p2 = edge_points_xy[sample_idx]
                
                # Calculate line equation: ax + by + c = 0
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                length = np.sqrt(dx**2 + dy**2)
                
                if length < 1e-6:
                    continue
                
                # Normalize
                a = -dy / length
                b = dx / length
                c = -(a * p1[0] + b * p1[1])
                
                # Count inliers (points close to line)
                distances = np.abs(a * edge_points_xy[:, 0] + b * edge_points_xy[:, 1] + c)
                inliers = np.sum(distances < distance_threshold)
                
                if inliers > best_inliers:
                    best_inliers = inliers
                    best_line = (p1, p2, a, b, c)
            
            if best_line and best_inliers > 10:
                p1, p2, a, b, c = best_line
                
                # Extend line to frame boundaries
                h, w = search_frame.shape[:2]
                line_points = []
                
                # Find intersections with frame boundaries
                # Top edge (y=0)
                if abs(b) > 1e-6:
                    x_top = -c / a if abs(a) > 1e-6 else 0
                    if 0 <= x_top <= w:
                        line_points.append((x_top, 0))
                
                # Bottom edge (y=h)
                if abs(b) > 1e-6:
                    x_bottom = -(b * h + c) / a if abs(a) > 1e-6 else w
                    if 0 <= x_bottom <= w:
                        line_points.append((x_bottom, h))
                
                # Left edge (x=0)
                if abs(a) > 1e-6:
                    y_left = -c / b if abs(b) > 1e-6 else 0
                    if 0 <= y_left <= h:
                        line_points.append((0, y_left))
                
                # Right edge (x=w)
                if abs(a) > 1e-6:
                    y_right = -(a * w + c) / b if abs(b) > 1e-6 else h
                    if 0 <= y_right <= h:
                        line_points.append((w, y_right))
                
                if len(line_points) >= 2:
                    # Use two points on frame boundary
                    x1, y1 = line_points[0]
                    x2, y2 = line_points[1] if len(line_points) > 1 else line_points[0]
                    
                    # Adjust for offset if region was used
                    x1 += offset_x
                    y1 += offset_y
                    x2 += offset_x
                    y2 += offset_y
                    
                    angle = self._calculate_angle(x1, y1, x2, y2)
                    
                    # Create bbox
                    margin = 5
                    bbox_x1 = max(0, int(min(x1, x2) - margin))
                    bbox_y1 = max(0, int(min(y1, y2) - margin))
                    bbox_x2 = min(frame.shape[1], int(max(x1, x2) + margin))
                    bbox_y2 = min(frame.shape[0], int(max(y1, y2) + margin))
                    
                    return {
                        'bbox': [float(bbox_x1), float(bbox_y1), float(bbox_x2), float(bbox_y2)],
                        'confidence': min(0.8, 0.5 + best_inliers / 100.0),  # Confidence based on inliers
                        'angle': angle,
                        'method': 'ransac'
                    }
        
        except Exception as e:
            logger.debug(f"RANSAC bat detection error: {e}")
        
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
            # First try pose-based detection
            if pose_landmarks:
                pose_result = self.detect_bat_from_pose(frame, pose_landmarks)
                if pose_result:
                    return pose_result
                
                # If pose landmarks available, use them to define search region
                hand_region = self._get_hand_region(pose_landmarks, frame.shape)
                if hand_region:
                    # Try RANSAC in hand region
                    ransac_result = self._detect_bat_lines_ransac(frame, hand_region)
                    if ransac_result:
                        return ransac_result
            
            # Fallback: detect lines in full frame with adaptive HoughLinesP
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY) if len(frame.shape) == 3 else frame
            h, w = gray.shape
            
            # Adaptive parameters based on frame size
            min_line_length = max(30, int(min(h, w) * 0.1))
            threshold = max(50, int(min(h, w) * 0.05))
            
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=threshold, 
                                   minLineLength=min_line_length, maxLineGap=10)
            
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
            
            # Last resort: try RANSAC on full frame
            return self._detect_bat_lines_ransac(frame)
        
        except Exception as e:
            logger.error(f"MediaPipe bat detection error: {e}")
        
        return None
    
    def detect_bat(self, frame: np.ndarray, pose_landmarks: Optional[List] = None) -> Optional[Dict]:
        """
        Detect bat in frame using configured method with tracking
        
        Args:
            frame: Input frame as numpy array
            pose_landmarks: MediaPipe pose landmarks (optional)
            
        Returns:
            Dictionary with bat detection results or None
        """
        detection = None
        
        # Try YOLO first
        if self.use_yolo and self.yolo_model:
            detection = self.detect_bat_yolo(frame)
        
        # Fallback to MediaPipe-based detection (more aggressive)
        if not detection:
            detection = self.detect_bat_mediapipe(frame, pose_landmarks)
        
        # If still no detection and we have pose landmarks, try pose-based detection directly
        if not detection and pose_landmarks:
            detection = self.detect_bat_from_pose(frame, pose_landmarks)
            if detection:
                logger.debug("Bat detected using pose landmarks fallback")
        
        # Update tracker if enabled
        if self.enable_tracking:
            if self.use_advanced_tracking and self.advanced_tracker:
                # Use advanced tracker
                detection = self.advanced_tracker.update(detection)
            elif self.tracker:
                # Use simple tracker
                detection = self.tracker.update(detection)
        
        return detection
    
    def _get_hand_region(self, landmarks: List, frame_shape: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
        """Extract hand region from pose landmarks"""
        try:
            h, w = frame_shape[:2]
            
            # Handle both MediaPipe landmark objects and dict format
            wrist_x = None
            wrist_y = None
            elbow_x = None
            elbow_y = None
            
            if isinstance(landmarks, list) and len(landmarks) > 15:
                # Check if it's a list of dicts (from PoseDetector output)
                if isinstance(landmarks[15], dict):
                    wrist_x = landmarks[15]['x'] * w
                    wrist_y = landmarks[15]['y'] * h
                    if len(landmarks) > 13:
                        elbow_x = landmarks[13]['x'] * w
                        elbow_y = landmarks[13]['y'] * h
                # Check if it's MediaPipe landmark objects
                elif hasattr(landmarks[15], 'x'):
                    wrist_x = landmarks[15].x * w
                    wrist_y = landmarks[15].y * h
                    if len(landmarks) > 13:
                        elbow_x = landmarks[13].x * w
                        elbow_y = landmarks[13].y * h
            
            if wrist_x is not None and wrist_y is not None and elbow_x is not None and elbow_y is not None:
                # Expand region around hand
                margin = 80  # Increased margin for better bat detection
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

