"""
Advanced object tracking service for baseball swing analysis
Provides robust multi-object tracking with Kalman Filter, IoU matching, and feature matching
"""
import cv2
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import time

logger = logging.getLogger(__name__)

class TrackState(Enum):
    """Track state"""
    TENTATIVE = "tentative"  # New track, not confirmed
    CONFIRMED = "confirmed"  # Track confirmed
    DELETED = "deleted"  # Track deleted (lost)

@dataclass
class Track:
    """Represents a tracked object"""
    track_id: int
    bbox: List[float]  # [x1, y1, x2, y2]
    confidence: float
    class_name: str
    state: TrackState
    age: int  # Frames since first detection
    time_since_update: int  # Frames since last update
    hits: int  # Number of detections matched
    hit_streak: int  # Consecutive hits
    kalman_filter: Optional[cv2.KalmanFilter]
    features: Optional[np.ndarray]  # Feature vector for appearance matching
    
    def __init__(self, track_id: int, bbox: List[float], confidence: float, 
                 class_name: str, kalman_filter: Optional[cv2.KalmanFilter] = None):
        self.track_id = track_id
        self.bbox = bbox
        self.confidence = confidence
        self.class_name = class_name
        self.state = TrackState.TENTATIVE
        self.age = 0
        self.time_since_update = 0
        self.hits = 0
        self.hit_streak = 0
        self.kalman_filter = kalman_filter
        self.features = None
    
    def to_xyah(self) -> np.ndarray:
        """Convert bbox to [x, y, aspect_ratio, height] format for Kalman Filter"""
        x1, y1, x2, y2 = self.bbox
        w = x2 - x1
        h = y2 - y1
        x = x1 + w / 2
        y = y1 + h / 2
        a = w / h if h > 0 else 1.0
        return np.array([x, y, a, h], dtype=np.float32)
    
    def from_xyah(self, xyah: np.ndarray) -> List[float]:
        """Convert [x, y, aspect_ratio, height] to bbox"""
        x, y, a, h = xyah
        w = a * h
        return [float(x - w/2), float(y - h/2), float(x + w/2), float(y + h/2)]

class MultiObjectTracker:
    """Advanced multi-object tracker using Kalman Filter and IoU matching"""
    
    def __init__(self, 
                 max_age: int = 30,
                 min_hits: int = 3,
                 iou_threshold: float = 0.3,
                 use_kalman: bool = True):
        """
        Initialize multi-object tracker
        
        Args:
            max_age: Maximum frames to keep track without update
            min_hits: Minimum hits to confirm track
            iou_threshold: IoU threshold for matching
            use_kalman: Whether to use Kalman Filter for prediction
        """
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.use_kalman = use_kalman
        
        self.tracks: List[Track] = []
        self.frame_count = 0
        self.next_id = 1
    
    def update(self, detections: List[Dict]) -> List[Dict]:
        """
        Update tracker with new detections
        
        Args:
            detections: List of detection dictionaries with 'bbox', 'confidence', 'class'
            
        Returns:
            List of tracked objects with track_id
        """
        self.frame_count += 1
        
        # Predict using Kalman Filter
        for track in self.tracks:
            if track.kalman_filter and self.use_kalman:
                prediction = track.kalman_filter.predict()
                xyah = prediction[:4]
                track.bbox = track.from_xyah(xyah)
            track.age += 1
            track.time_since_update += 1
        
        # Match detections to tracks
        matched, unmatched_dets, unmatched_trks = self._associate_detections_to_trackers(
            detections, self.tracks
        )
        
        # Update matched tracks
        for m in matched:
            track = self.tracks[m[1]]
            det = detections[m[0]]
            
            # Update Kalman Filter
            if track.kalman_filter and self.use_kalman:
                xyah = track.to_xyah()
                measurement = np.array([[xyah[0]], [xyah[1]], [xyah[2]], [xyah[3]]], dtype=np.float32)
                track.kalman_filter.correct(measurement)
                xyah_updated = track.kalman_filter.statePost[:4]
                track.bbox = track.from_xyah(xyah_updated)
            else:
                track.bbox = det['bbox']
            
            track.confidence = det.get('confidence', track.confidence)
            track.time_since_update = 0
            track.hits += 1
            track.hit_streak += 1
            
            # Confirm track if enough hits
            if track.state == TrackState.TENTATIVE and track.hits >= self.min_hits:
                track.state = TrackState.CONFIRMED
        
        # Create new tracks for unmatched detections
        for i in unmatched_dets:
            det = detections[i]
            track = self._create_track(det)
            self.tracks.append(track)
        
        # Delete old tracks
        self.tracks = [t for t in self.tracks if t.time_since_update < self.max_age]
        
        # Return confirmed tracks
        confirmed_tracks = [t for t in self.tracks if t.state == TrackState.CONFIRMED]
        
        return [self._track_to_dict(t) for t in confirmed_tracks]
    
    def _create_track(self, detection: Dict) -> Track:
        """Create new track from detection"""
        track_id = self.next_id
        self.next_id += 1
        
        bbox = detection['bbox']
        confidence = detection.get('confidence', 0.5)
        class_name = detection.get('class', 'unknown')
        
        # Initialize Kalman Filter
        kf = None
        if self.use_kalman:
            kf = self._create_kalman_filter(bbox)
        
        track = Track(track_id, bbox, confidence, class_name, kf)
        return track
    
    def _create_kalman_filter(self, bbox: List[float]) -> cv2.KalmanFilter:
        """Create Kalman Filter for tracking"""
        kf = cv2.KalmanFilter(7, 4)  # 7 state vars, 4 measurements
        
        # State: [x, y, a, h, vx, vy, va]
        # Measurement: [x, y, a, h]
        
        # Transition matrix (constant velocity model)
        kf.transitionMatrix = np.array([
            [1, 0, 0, 0, 1, 0, 0],  # x' = x + vx
            [0, 1, 0, 0, 0, 1, 0],  # y' = y + vy
            [0, 0, 1, 0, 0, 0, 1],  # a' = a + va
            [0, 0, 0, 1, 0, 0, 0],  # h' = h
            [0, 0, 0, 0, 1, 0, 0],  # vx' = vx
            [0, 0, 0, 0, 0, 1, 0],  # vy' = vy
            [0, 0, 0, 0, 0, 0, 1]   # va' = va
        ], dtype=np.float32)
        
        # Measurement matrix
        kf.measurementMatrix = np.array([
            [1, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0]
        ], dtype=np.float32)
        
        # Process noise
        kf.processNoiseCov = np.eye(7, dtype=np.float32) * 0.03
        
        # Measurement noise
        kf.measurementNoiseCov = np.eye(4, dtype=np.float32) * 0.1
        
        # Error covariance
        kf.errorCovPost = np.eye(7, dtype=np.float32)
        
        # Initialize state
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        x = x1 + w / 2
        y = y1 + h / 2
        a = w / h if h > 0 else 1.0
        
        kf.statePre = np.array([x, y, a, h, 0, 0, 0], dtype=np.float32)
        kf.statePost = np.array([x, y, a, h, 0, 0, 0], dtype=np.float32)
        
        return kf
    
    def _associate_detections_to_trackers(self,
                                         detections: List[Dict],
                                         tracks: List[Track]) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """
        Associate detections to tracks using IoU matching
        
        Returns:
            (matched, unmatched_dets, unmatched_trks)
        """
        if len(tracks) == 0:
            return [], list(range(len(detections))), []
        
        if len(detections) == 0:
            return [], [], list(range(len(tracks)))
        
        # Calculate IoU matrix
        iou_matrix = np.zeros((len(detections), len(tracks)), dtype=np.float32)
        
        for d, det in enumerate(detections):
            for t, track in enumerate(tracks):
                iou = self._calculate_iou(det['bbox'], track.bbox)
                iou_matrix[d, t] = iou
        
        # Hungarian algorithm (simplified greedy matching)
        matched = []
        unmatched_dets = []
        unmatched_trks = []
        
        # Greedy matching (can be improved with Hungarian algorithm)
        used_detections = set()
        used_tracks = set()
        
        # Sort by IoU (highest first)
        matches = []
        for d in range(len(detections)):
            for t in range(len(tracks)):
                if iou_matrix[d, t] > self.iou_threshold:
                    matches.append((iou_matrix[d, t], d, t))
        
        matches.sort(reverse=True, key=lambda x: x[0])
        
        for iou, d, t in matches:
            if d not in used_detections and t not in used_tracks:
                matched.append((d, t))
                used_detections.add(d)
                used_tracks.add(t)
        
        # Find unmatched
        for d in range(len(detections)):
            if d not in used_detections:
                unmatched_dets.append(d)
        
        for t in range(len(tracks)):
            if t not in used_tracks:
                unmatched_trks.append(t)
        
        return matched, unmatched_dets, unmatched_trks
    
    def _calculate_iou(self, bbox1: List[float], bbox2: List[float]) -> float:
        """Calculate Intersection over Union (IoU)"""
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i <= x1_i or y2_i <= y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        
        # Calculate union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0
    
    def _track_to_dict(self, track: Track) -> Dict:
        """Convert track to dictionary"""
        return {
            'track_id': track.track_id,
            'bbox': track.bbox,
            'confidence': track.confidence,
            'class': track.class_name,
            'age': track.age,
            'hits': track.hits,
            'hit_streak': track.hit_streak,
            'state': track.state.value
        }
    
    def get_track_by_id(self, track_id: int) -> Optional[Track]:
        """Get track by ID"""
        for track in self.tracks:
            if track.track_id == track_id:
                return track
        return None
    
    def reset(self):
        """Reset tracker"""
        self.tracks = []
        self.frame_count = 0
        self.next_id = 1

class PersonTracker:
    """Specialized tracker for person tracking"""
    
    def __init__(self, use_kalman: bool = True):
        """
        Initialize person tracker
        
        Args:
            use_kalman: Whether to use Kalman Filter
        """
        self.tracker = MultiObjectTracker(
            max_age=30,
            min_hits=2,
            iou_threshold=0.3,
            use_kalman=use_kalman
        )
        self.current_person_track: Optional[Dict] = None
    
    def update(self, person_detection: Optional[Dict]) -> Optional[Dict]:
        """
        Update person tracker
        
        Args:
            person_detection: Person detection result or None
            
        Returns:
            Tracked person with track_id or None
        """
        detections = []
        if person_detection:
            detections.append({
                'bbox': person_detection['bbox'],
                'confidence': person_detection.get('confidence', 0.5),
                'class': 'person'
            })
        
        tracks = self.tracker.update(detections)
        
        if tracks:
            # Get the most confident track
            best_track = max(tracks, key=lambda t: t.get('confidence', 0))
            self.current_person_track = best_track
            return best_track
        
        # If no detection but we have a track, return predicted position
        if self.current_person_track:
            track_id = self.current_person_track['track_id']
            track = self.tracker.get_track_by_id(track_id)
            if track and track.time_since_update < 10:  # Still valid
                return {
                    'track_id': track.track_id,
                    'bbox': track.bbox,
                    'confidence': track.confidence * 0.7,  # Lower confidence for prediction
                    'class': 'person',
                    'predicted': True
                }
        
        self.current_person_track = None
        return None

class BatTrackerAdvanced:
    """Advanced bat tracker with Kalman Filter"""
    
    def __init__(self, use_kalman: bool = True):
        """
        Initialize advanced bat tracker
        
        Args:
            use_kalman: Whether to use Kalman Filter
        """
        self.tracker = MultiObjectTracker(
            max_age=15,  # Shorter for bat (moves faster)
            min_hits=2,
            iou_threshold=0.2,  # Lower threshold for bat (smaller object)
            use_kalman=use_kalman
        )
        self.current_bat_track: Optional[Dict] = None
    
    def update(self, bat_detection: Optional[Dict]) -> Optional[Dict]:
        """
        Update bat tracker
        
        Args:
            bat_detection: Bat detection result or None
            
        Returns:
            Tracked bat with track_id or None
        """
        detections = []
        if bat_detection:
            detections.append({
                'bbox': bat_detection['bbox'],
                'confidence': bat_detection.get('confidence', 0.5),
                'class': 'bat'
            })
        
        tracks = self.tracker.update(detections)
        
        if tracks:
            best_track = max(tracks, key=lambda t: t.get('confidence', 0))
            self.current_bat_track = best_track
            
            # Add angle and method from original detection
            if bat_detection:
                best_track['angle'] = bat_detection.get('angle')
                best_track['method'] = bat_detection.get('method')
            
            return best_track
        
        # Return predicted position if available
        if self.current_bat_track:
            track_id = self.current_bat_track['track_id']
            track = self.tracker.get_track_by_id(track_id)
            if track and track.time_since_update < 5:  # Shorter for bat
                result = {
                    'track_id': track.track_id,
                    'bbox': track.bbox,
                    'confidence': track.confidence * 0.6,
                    'class': 'bat',
                    'predicted': True
                }
                # Try to preserve angle from last detection
                if 'angle' in self.current_bat_track:
                    result['angle'] = self.current_bat_track['angle']
                return result
        
        self.current_bat_track = None
        return None

class BallTrackerAdvanced:
    """Advanced ball tracker with improved Kalman Filter"""
    
    def __init__(self, use_kalman: bool = True):
        """
        Initialize advanced ball tracker
        
        Args:
            use_kalman: Whether to use Kalman Filter
        """
        self.tracker = MultiObjectTracker(
            max_age=20,  # Medium for ball
            min_hits=2,
            iou_threshold=0.25,  # Medium threshold
            use_kalman=use_kalman
        )
        self.current_ball_track: Optional[Dict] = None
    
    def update(self, ball_detection: Optional[Dict]) -> Optional[Dict]:
        """
        Update ball tracker
        
        Args:
            ball_detection: Ball detection result or None
            
        Returns:
            Tracked ball with track_id or None
        """
        detections = []
        if ball_detection:
            detections.append({
                'bbox': ball_detection['bbox'],
                'confidence': ball_detection.get('confidence', 0.5),
                'class': 'ball'
            })
        
        tracks = self.tracker.update(detections)
        
        if tracks:
            best_track = max(tracks, key=lambda t: t.get('confidence', 0))
            self.current_ball_track = best_track
            
            # Add ball-specific info
            if ball_detection:
                best_track['center'] = ball_detection.get('center')
                best_track['radius'] = ball_detection.get('radius')
                best_track['method'] = ball_detection.get('method')
            
            return best_track
        
        # Return predicted position
        if self.current_ball_track:
            track_id = self.current_ball_track['track_id']
            track = self.tracker.get_track_by_id(track_id)
            if track and track.time_since_update < 8:
                result = {
                    'track_id': track.track_id,
                    'bbox': track.bbox,
                    'confidence': track.confidence * 0.5,
                    'class': 'ball',
                    'predicted': True
                }
                # Calculate center from bbox
                x1, y1, x2, y2 = track.bbox
                result['center'] = [(x1 + x2) / 2, (y1 + y2) / 2]
                result['radius'] = max((x2 - x1), (y2 - y1)) / 2
                return result
        
        self.current_ball_track = None
        return None

