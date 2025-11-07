"""
Contact detection service for baseball swing analysis
Detects when bat makes contact with ball
"""
import numpy as np
import logging
from typing import Dict, Optional, List, Tuple
from scipy.signal import find_peaks

logger = logging.getLogger(__name__)

class ContactDetector:
    """Detects contact between bat and ball"""
    
    def __init__(self, proximity_threshold: float = 50.0, velocity_threshold: float = 5.0):
        """
        Initialize contact detector
        
        Args:
            proximity_threshold: Maximum distance (pixels) for bat/ball proximity
            velocity_threshold: Minimum velocity change for contact confirmation
        """
        self.proximity_threshold = proximity_threshold
        self.velocity_threshold = velocity_threshold
    
    def detect_contact(self, 
                      bat_angles: List[float],
                      bat_positions: List[Optional[Tuple[float, float]]],
                      ball_positions: List[Optional[Dict]],
                      fps: float = 30.0) -> Optional[Dict]:
        """
        Detect contact frame using temporal and spatial analysis
        
        Args:
            bat_angles: List of bat angles per frame
            bat_positions: List of bat positions (center or endpoints) per frame
            ball_positions: List of ball detection results per frame
            fps: Frames per second of video
            
        Returns:
            Dictionary with contact frame info or None
        """
        if not bat_angles or len(bat_angles) < 3:
            return None
        
        # Calculate bat angular velocity
        angular_velocities = self._calculate_angular_velocity(bat_angles, fps)
        
        # Find peak angular velocity (swing moment)
        peak_frame = self._find_peak_velocity(angular_velocities)
        
        if peak_frame is None:
            return None
        
        # Check bat/ball proximity at peak frame
        proximity_check = self._check_proximity(
            peak_frame,
            bat_positions,
            ball_positions
        )
        
        # Check for sudden ball velocity change (optical flow confirmation)
        velocity_change = self._check_velocity_change(
            peak_frame,
            ball_positions,
            fps
        )
        
        # Calculate confidence based on multiple factors
        confidence = self._calculate_confidence(
            angular_velocities[peak_frame] if peak_frame < len(angular_velocities) else 0,
            proximity_check,
            velocity_change
        )
        
        if confidence > 0.3:  # Minimum confidence threshold
            return {
                'frame': peak_frame,
                'confidence': confidence,
                'angular_velocity': angular_velocities[peak_frame] if peak_frame < len(angular_velocities) else 0,
                'proximity': proximity_check['distance'] if proximity_check else None,
                'velocity_change': velocity_change,
                'timestamp': peak_frame / fps if fps > 0 else 0
            }
        
        return None
    
    def _calculate_angular_velocity(self, angles: List[float], fps: float) -> List[float]:
        """Calculate bat angular velocity over time"""
        if len(angles) < 2:
            return [0.0]
        
        velocities = []
        dt = 1.0 / fps if fps > 0 else 1.0
        
        for i in range(1, len(angles)):
            # Handle angle wrapping (e.g., -179 to 179)
            angle_diff = angles[i] - angles[i-1]
            
            # Normalize to [-180, 180]
            if angle_diff > 180:
                angle_diff -= 360
            elif angle_diff < -180:
                angle_diff += 360
            
            velocity = angle_diff / dt
            velocities.append(abs(velocity))  # Use absolute value
        
        # Add first frame (no previous frame)
        velocities.insert(0, 0.0)
        
        return velocities
    
    def _find_peak_velocity(self, velocities: List[float]) -> Optional[int]:
        """Find frame with peak angular velocity"""
        if not velocities:
            return None
        
        # Use scipy to find peaks
        try:
            peaks, properties = find_peaks(velocities, height=np.max(velocities) * 0.5, distance=5)
            
            if len(peaks) > 0:
                # Return the highest peak
                peak_heights = [velocities[p] for p in peaks]
                max_peak_idx = np.argmax(peak_heights)
                return int(peaks[max_peak_idx])
        except Exception as e:
            logger.debug(f"Peak finding error: {e}")
        
        # Fallback: find maximum manually
        max_idx = np.argmax(velocities)
        if velocities[max_idx] > 0:
            return int(max_idx)
        
        return None
    
    def _check_proximity(self, 
                        frame: int,
                        bat_positions: List[Optional[Tuple[float, float]]],
                        ball_positions: List[Optional[Dict]]) -> Optional[Dict]:
        """Check if bat and ball are close at given frame"""
        if frame >= len(bat_positions) or frame >= len(ball_positions):
            return None
        
        bat_pos = bat_positions[frame]
        ball_detection = ball_positions[frame]
        
        if not bat_pos or not ball_detection:
            return None
        
        ball_center = ball_detection.get('center')
        if not ball_center:
            return None
        
        # Calculate distance between bat and ball
        distance = np.sqrt(
            (bat_pos[0] - ball_center[0])**2 + 
            (bat_pos[1] - ball_center[1])**2
        )
        
        return {
            'distance': float(distance),
            'within_threshold': distance <= self.proximity_threshold
        }
    
    def _check_velocity_change(self,
                               frame: int,
                               ball_positions: List[Optional[Dict]],
                               fps: float) -> Optional[float]:
        """Check for sudden ball velocity change after contact"""
        if frame >= len(ball_positions) - 1:
            return None
        
        # Get ball velocity before and after contact frame
        prev_velocity = 0.0
        post_velocity = 0.0
        
        # Before contact (average of previous frames)
        prev_frames = []
        for i in range(max(0, frame - 3), frame):
            if i < len(ball_positions) and ball_positions[i]:
                vel = ball_positions[i].get('velocity', 0.0)
                prev_frames.append(vel)
        
        if prev_frames:
            prev_velocity = np.mean(prev_frames)
        
        # After contact (average of next frames)
        post_frames = []
        for i in range(frame + 1, min(len(ball_positions), frame + 4)):
            if i < len(ball_positions) and ball_positions[i]:
                vel = ball_positions[i].get('velocity', 0.0)
                post_frames.append(vel)
        
        if post_frames:
            post_velocity = np.mean(post_frames)
        
        # Calculate velocity change
        velocity_change = post_velocity - prev_velocity
        
        return float(velocity_change) if abs(velocity_change) >= self.velocity_threshold else None
    
    def _calculate_confidence(self,
                              angular_velocity: float,
                              proximity_check: Optional[Dict],
                              velocity_change: Optional[float]) -> float:
        """Calculate contact detection confidence"""
        confidence = 0.0
        
        # Angular velocity factor (higher velocity = higher confidence)
        if angular_velocity > 0:
            # Normalize to 0-1 (assuming max velocity around 50 deg/s)
            vel_factor = min(1.0, angular_velocity / 50.0)
            confidence += vel_factor * 0.4
        
        # Proximity factor
        if proximity_check:
            if proximity_check['within_threshold']:
                # Closer = higher confidence
                distance = proximity_check['distance']
                prox_factor = 1.0 - min(1.0, distance / self.proximity_threshold)
                confidence += prox_factor * 0.4
            else:
                confidence += 0.1  # Small bonus even if not within threshold
        
        # Velocity change factor
        if velocity_change is not None:
            # Sudden velocity increase indicates contact
            if velocity_change > 0:
                change_factor = min(1.0, velocity_change / (self.velocity_threshold * 2))
                confidence += change_factor * 0.2
        
        return min(1.0, confidence)

