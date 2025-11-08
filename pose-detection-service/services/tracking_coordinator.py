"""
Tracking coordinator for baseball swing analysis
Coordinates tracking of multiple objects (person, bat, ball) across frames
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple

from services.object_tracker import (
    PersonTracker,
    BatTrackerAdvanced,
    BallTrackerAdvanced,
    MultiObjectTracker
)

logger = logging.getLogger(__name__)

class TrackingCoordinator:
    """Coordinates tracking of all objects in baseball swing"""
    
    def __init__(self, use_kalman: bool = True):
        """
        Initialize tracking coordinator
        
        Args:
            use_kalman: Whether to use Kalman Filter for tracking
        """
        self.use_kalman = use_kalman
        self.person_tracker = PersonTracker(use_kalman=use_kalman)
        self.bat_tracker = BatTrackerAdvanced(use_kalman=use_kalman)
        self.ball_tracker = BallTrackerAdvanced(use_kalman=use_kalman)
        
        # Frame history for temporal analysis
        self.frame_history: List[Dict] = []
        self.max_history = 30
    
    def update_frame(self,
                    person_detection: Optional[Dict],
                    bat_detection: Optional[Dict],
                    ball_detection: Optional[Dict],
                    pose_landmarks: Optional[List],
                    frame_idx: int = 0) -> Dict:
        """
        Update all trackers with new frame data
        
        Args:
            person_detection: Person detection result
            bat_detection: Bat detection result
            ball_detection: Ball detection result
            pose_landmarks: Pose landmarks
            frame_idx: Current frame index
            
        Returns:
            Dictionary with all tracked objects
        """
        # Update individual trackers
        tracked_person = self.person_tracker.update(person_detection)
        tracked_bat = self.bat_tracker.update(bat_detection)
        tracked_ball = self.ball_tracker.update(ball_detection)
        
        # Create frame data
        frame_data = {
            'frame': frame_idx,
            'person': tracked_person,
            'bat': tracked_bat,
            'ball': tracked_ball,
            'pose_landmarks': pose_landmarks
        }
        
        # Add to history
        self.frame_history.append(frame_data)
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)
        
        # Calculate temporal relationships
        relationships = self._calculate_relationships(tracked_person, tracked_bat, tracked_ball)
        
        return {
            'frame': frame_idx,
            'person': tracked_person,
            'bat': tracked_bat,
            'ball': tracked_ball,
            'relationships': relationships,
            'tracking_quality': self._assess_tracking_quality()
        }
    
    def _calculate_relationships(self,
                                person: Optional[Dict],
                                bat: Optional[Dict],
                                ball: Optional[Dict]) -> Dict:
        """Calculate spatial and temporal relationships between objects"""
        relationships = {}
        
        # Person-Bat relationship
        if person and bat:
            person_center = self._get_bbox_center(person.get('bbox'))
            bat_center = self._get_bbox_center(bat.get('bbox'))
            
            if person_center and bat_center:
                distance = np.sqrt(
                    (person_center[0] - bat_center[0])**2 + 
                    (person_center[1] - bat_center[1])**2
                )
                relationships['person_bat_distance'] = float(distance)
                relationships['person_bat_proximity'] = distance < 150  # Close if < 150 pixels
        
        # Bat-Ball relationship
        if bat and ball:
            bat_center = self._get_bbox_center(bat.get('bbox'))
            ball_center = ball.get('center') or self._get_bbox_center(ball.get('bbox'))
            
            if bat_center and ball_center:
                distance = np.sqrt(
                    (bat_center[0] - ball_center[0])**2 + 
                    (bat_center[1] - ball_center[1])**2
                )
                relationships['bat_ball_distance'] = float(distance)
                relationships['bat_ball_proximity'] = distance < 50  # Very close = potential contact
                relationships['contact_likelihood'] = max(0.0, 1.0 - distance / 100.0)  # 0-1 score
        
        # Person-Ball relationship
        if person and ball:
            person_center = self._get_bbox_center(person.get('bbox'))
            ball_center = ball.get('center') or self._get_bbox_center(ball.get('bbox'))
            
            if person_center and ball_center:
                distance = np.sqrt(
                    (person_center[0] - ball_center[0])**2 + 
                    (person_center[1] - ball_center[1])**2
                )
                relationships['person_ball_distance'] = float(distance)
        
        # Temporal consistency (check if objects are moving together)
        if len(self.frame_history) > 1:
            prev_frame = self.frame_history[-2]
            curr_person = person
            curr_bat = bat
            
            if curr_person and prev_frame.get('person'):
                prev_person_center = self._get_bbox_center(prev_frame['person'].get('bbox'))
                curr_person_center = self._get_bbox_center(curr_person.get('bbox'))
                
                if prev_person_center and curr_person_center:
                    person_velocity = np.sqrt(
                        (curr_person_center[0] - prev_person_center[0])**2 +
                        (curr_person_center[1] - prev_person_center[1])**2
                    )
                    relationships['person_velocity'] = float(person_velocity)
            
            if curr_bat and prev_frame.get('bat'):
                prev_bat_center = self._get_bbox_center(prev_frame['bat'].get('bbox'))
                curr_bat_center = self._get_bbox_center(curr_bat.get('bbox'))
                
                if prev_bat_center and curr_bat_center:
                    bat_velocity = np.sqrt(
                        (curr_bat_center[0] - prev_bat_center[0])**2 +
                        (curr_bat_center[1] - prev_bat_center[1])**2
                    )
                    relationships['bat_velocity'] = float(bat_velocity)
        
        return relationships
    
    def _get_bbox_center(self, bbox: Optional[List[float]]) -> Optional[Tuple[float, float]]:
        """Get center point from bbox"""
        if not bbox or len(bbox) < 4:
            return None
        return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
    
    def _assess_tracking_quality(self) -> Dict:
        """Assess overall tracking quality"""
        if len(self.frame_history) == 0:
            return {'score': 0.0, 'issues': []}
        
        # Count how many objects are being tracked
        recent_frames = self.frame_history[-10:] if len(self.frame_history) >= 10 else self.frame_history
        
        person_tracked = sum(1 for f in recent_frames if f.get('person'))
        bat_tracked = sum(1 for f in recent_frames if f.get('bat'))
        ball_tracked = sum(1 for f in recent_frames if f.get('ball'))
        
        total_frames = len(recent_frames)
        person_ratio = person_tracked / total_frames if total_frames > 0 else 0
        bat_ratio = bat_tracked / total_frames if total_frames > 0 else 0
        ball_ratio = ball_tracked / total_frames if total_frames > 0 else 0
        
        # Overall score (weighted)
        score = (person_ratio * 0.4 + bat_ratio * 0.4 + ball_ratio * 0.2)
        
        issues = []
        if person_ratio < 0.7:
            issues.append("Person tracking inconsistent")
        if bat_ratio < 0.5:
            issues.append("Bat tracking inconsistent")
        if ball_ratio < 0.3:
            issues.append("Ball tracking inconsistent (expected - ball moves fast)")
        
        return {
            'score': float(score),
            'person_tracking_ratio': float(person_ratio),
            'bat_tracking_ratio': float(bat_ratio),
            'ball_tracking_ratio': float(ball_ratio),
            'issues': issues
        }
    
    def get_trajectories(self, num_frames: int = 10) -> Dict:
        """
        Get trajectories of tracked objects
        
        Args:
            num_frames: Number of recent frames to include
            
        Returns:
            Dictionary with trajectories for each object
        """
        recent_frames = self.frame_history[-num_frames:] if len(self.frame_history) > num_frames else self.frame_history
        
        trajectories = {
            'person': [],
            'bat': [],
            'ball': []
        }
        
        for frame_data in recent_frames:
            if frame_data.get('person'):
                center = self._get_bbox_center(frame_data['person'].get('bbox'))
                if center:
                    trajectories['person'].append({
                        'frame': frame_data['frame'],
                        'center': center,
                        'bbox': frame_data['person'].get('bbox')
                    })
            
            if frame_data.get('bat'):
                center = self._get_bbox_center(frame_data['bat'].get('bbox'))
                if center:
                    trajectories['bat'].append({
                        'frame': frame_data['frame'],
                        'center': center,
                        'bbox': frame_data['bat'].get('bbox'),
                        'angle': frame_data['bat'].get('angle')
                    })
            
            if frame_data.get('ball'):
                center = frame_data['ball'].get('center') or self._get_bbox_center(frame_data['ball'].get('bbox'))
                if center:
                    trajectories['ball'].append({
                        'frame': frame_data['frame'],
                        'center': center,
                        'bbox': frame_data['ball'].get('bbox')
                    })
        
        return trajectories
    
    def reset(self):
        """Reset all trackers"""
        self.person_tracker.tracker.reset()
        self.bat_tracker.tracker.reset()
        self.ball_tracker.tracker.reset()
        self.frame_history = []

