"""
Metrics calculator for baseball swing analysis
Calculates bat speed, exit velocity, and form metrics
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from scipy.signal import savgol_filter

logger = logging.getLogger(__name__)

class MetricsCalculator:
    """Calculates swing metrics from pose and detection data"""
    
    def __init__(self, batter_height_m: Optional[float] = None):
        """
        Initialize metrics calculator
        
        Args:
            batter_height_m: Batter height in meters (for scale calibration)
        """
        self.batter_height_m = batter_height_m or 1.75  # Default 5'9"
        self.ideal_ranges = {
            'hip_rotation': (45, 55),  # degrees
            'shoulder_separation': (30, 40),  # degrees
            'front_knee_flex': (120, 150),  # degrees
            'stride_length': (0.3, 0.5),  # meters
            'spine_tilt': (-10, 10),  # degrees
            'elbow_extension': (150, 180),  # degrees
        }
    
    def calculate_bat_speed(self,
                           bat_angles: List[float],
                           contact_frame: int,
                           fps: float,
                           shoulder_to_impact_distance: Optional[float] = None) -> Dict:
        """
        Calculate bat speed at contact
        
        Args:
            bat_angles: List of bat angles per frame
            contact_frame: Frame index of contact
            fps: Frames per second
            shoulder_to_impact_distance: Distance from shoulder to impact point (meters)
            
        Returns:
            Dictionary with bat speed metrics
        """
        if not bat_angles or contact_frame >= len(bat_angles):
            return {
                'angular_velocity': 0.0,
                'linear_speed': 0.0,
                'units': 'm/s'
            }
        
        # Calculate angular velocity at contact
        dt = 1.0 / fps if fps > 0 else 1.0
        
        if contact_frame > 0:
            angle_diff = bat_angles[contact_frame] - bat_angles[contact_frame - 1]
            # Normalize angle difference
            if angle_diff > 180:
                angle_diff -= 360
            elif angle_diff < -180:
                angle_diff += 360
            
            angular_velocity = abs(angle_diff) / dt  # degrees per second
        else:
            angular_velocity = 0.0
        
        # Convert to radians per second
        angular_velocity_rad = np.radians(angular_velocity)
        
        # Estimate radius (shoulder to impact distance)
        if shoulder_to_impact_distance:
            radius = shoulder_to_impact_distance
        else:
            # Default estimate: average arm length + bat length
            # Arm length ~0.4m, bat length ~0.9m, total ~1.3m
            radius = 1.3
        
        # Linear bat speed: v = ω * r
        linear_speed = angular_velocity_rad * radius  # m/s
        
        # Convert to mph for display
        linear_speed_mph = linear_speed * 2.237
        
        return {
            'angular_velocity': float(angular_velocity),
            'linear_speed': float(linear_speed),
            'linear_speed_mph': float(linear_speed_mph),
            'radius': float(radius),
            'units': 'm/s'
        }
    
    def estimate_exit_velocity(self,
                              bat_speed: float,
                              bat_angle: float,
                              impact_point: Optional[Tuple[float, float]] = None) -> Dict:
        """
        Estimate exit velocity using heuristic
        
        Args:
            bat_speed: Bat linear speed in m/s
            bat_angle: Bat angle at contact in degrees
            impact_point: Impact point on bat (normalized 0-1, optional)
            
        Returns:
            Dictionary with exit velocity estimate
        """
        # Heuristic formula: exit_velocity ≈ f(bat_speed, bat_angle, impact_point)
        # This is a simplified model - in practice, you'd use a trained regression model
        
        # Base estimate: exit velocity is typically 1.2-1.5x bat speed
        base_multiplier = 1.35
        
        # Adjust for bat angle (optimal angle around 0-10 degrees)
        angle_factor = 1.0
        if abs(bat_angle) < 10:
            angle_factor = 1.1  # Sweet spot
        elif abs(bat_angle) > 30:
            angle_factor = 0.9  # Poor contact
        
        # Adjust for impact point (sweet spot is center of bat)
        impact_factor = 1.0
        if impact_point:
            # Distance from center (0.5, 0.5)
            center_dist = np.sqrt((impact_point[0] - 0.5)**2 + (impact_point[1] - 0.5)**2)
            impact_factor = 1.0 - (center_dist * 0.3)  # Reduce by up to 30%
        
        exit_velocity = bat_speed * base_multiplier * angle_factor * impact_factor
        
        # Convert to mph
        exit_velocity_mph = exit_velocity * 2.237
        
        # Add error margin (±8% based on sensor studies)
        error_margin = exit_velocity * 0.08
        
        return {
            'exit_velocity': float(exit_velocity),
            'exit_velocity_mph': float(exit_velocity_mph),
            'error_margin': float(error_margin),
            'units': 'm/s',
            'note': 'Estimate only - use bat sensor for clinical accuracy'
        }
    
    def calculate_form_metrics(self,
                               pose_landmarks_list: List[List],
                               frame_shape: Tuple[int, int]) -> Dict:
        """
        Calculate form metrics from pose landmarks
        
        Args:
            pose_landmarks_list: List of pose landmark sets per frame
            frame_shape: (height, width) of frame
            
        Returns:
            Dictionary with form metrics
        """
        if not pose_landmarks_list:
            return {}
        
        # Calculate metrics for contact frame (or average across frames)
        contact_idx = len(pose_landmarks_list) // 2  # Use middle frame as proxy
        if contact_idx >= len(pose_landmarks_list):
            contact_idx = len(pose_landmarks_list) - 1
        
        landmarks = pose_landmarks_list[contact_idx]
        h, w = frame_shape[:2]
        
        metrics = {}
        
        # Hip rotation
        hip_rotation = self._calculate_hip_rotation(landmarks, w, h)
        if hip_rotation is not None:
            metrics['hip_rotation'] = {
                'value': hip_rotation,
                'ideal': self.ideal_ranges['hip_rotation'],
                'deviation': hip_rotation - np.mean(self.ideal_ranges['hip_rotation'])
            }
        
        # Shoulder separation
        shoulder_separation = self._calculate_shoulder_separation(landmarks, w, h)
        if shoulder_separation is not None:
            metrics['shoulder_separation'] = {
                'value': shoulder_separation,
                'ideal': self.ideal_ranges['shoulder_separation'],
                'deviation': shoulder_separation - np.mean(self.ideal_ranges['shoulder_separation'])
            }
        
        # Front knee flex
        knee_flex = self._calculate_knee_flex(landmarks, w, h)
        if knee_flex is not None:
            metrics['front_knee_flex'] = {
                'value': knee_flex,
                'ideal': self.ideal_ranges['front_knee_flex'],
                'deviation': knee_flex - np.mean(self.ideal_ranges['front_knee_flex'])
            }
        
        # Stride length
        stride_length = self._calculate_stride_length(landmarks, w, h)
        if stride_length is not None:
            metrics['stride_length'] = {
                'value': stride_length,
                'ideal': self.ideal_ranges['stride_length'],
                'deviation': stride_length - np.mean(self.ideal_ranges['stride_length'])
            }
        
        # Spine tilt
        spine_tilt = self._calculate_spine_tilt(landmarks, w, h)
        if spine_tilt is not None:
            metrics['spine_tilt'] = {
                'value': spine_tilt,
                'ideal': self.ideal_ranges['spine_tilt'],
                'deviation': spine_tilt - np.mean(self.ideal_ranges['spine_tilt'])
            }
        
        # Elbow extension
        elbow_extension = self._calculate_elbow_extension(landmarks, w, h)
        if elbow_extension is not None:
            metrics['elbow_extension'] = {
                'value': elbow_extension,
                'ideal': self.ideal_ranges['elbow_extension'],
                'deviation': elbow_extension - np.mean(self.ideal_ranges['elbow_extension'])
            }
        
        # Generate feedback
        feedback = self._generate_feedback(metrics)
        metrics['feedback'] = feedback
        
        return metrics
    
    def _get_landmark(self, landmarks: List, idx: int, w: float, h: float) -> Optional[Tuple[float, float]]:
        """Get landmark coordinates"""
        try:
            if idx >= len(landmarks):
                return None
            lm = landmarks[idx]
            if hasattr(lm, 'x') and hasattr(lm, 'y'):
                return (lm.x * w, lm.y * h)
        except Exception:
            pass
        return None
    
    def _calculate_hip_rotation(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate hip rotation angle"""
        # MediaPipe pose landmarks: LEFT_HIP=23, RIGHT_HIP=24
        left_hip = self._get_landmark(landmarks, 23, w, h)
        right_hip = self._get_landmark(landmarks, 24, w, h)
        
        if left_hip and right_hip:
            dx = right_hip[0] - left_hip[0]
            dy = right_hip[1] - left_hip[1]
            angle = np.degrees(np.arctan2(dy, dx))
            return float(angle)
        return None
    
    def _calculate_shoulder_separation(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate shoulder separation angle"""
        # MediaPipe pose landmarks: LEFT_SHOULDER=11, RIGHT_SHOULDER=12
        left_shoulder = self._get_landmark(landmarks, 11, w, h)
        right_shoulder = self._get_landmark(landmarks, 12, w, h)
        
        if left_shoulder and right_shoulder:
            dx = right_shoulder[0] - left_shoulder[0]
            dy = right_shoulder[1] - left_shoulder[1]
            angle = np.degrees(np.arctan2(dy, dx))
            return float(angle)
        return None
    
    def _calculate_knee_flex(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate front knee flexion angle"""
        # MediaPipe pose landmarks: LEFT_HIP=23, LEFT_KNEE=25, LEFT_ANKLE=27
        hip = self._get_landmark(landmarks, 23, w, h)
        knee = self._get_landmark(landmarks, 25, w, h)
        ankle = self._get_landmark(landmarks, 27, w, h)
        
        if hip and knee and ankle:
            # Calculate angle at knee
            v1 = np.array([hip[0] - knee[0], hip[1] - knee[1]])
            v2 = np.array([ankle[0] - knee[0], ankle[1] - knee[1]])
            
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            angle = np.degrees(np.arccos(cos_angle))
            return float(angle)
        return None
    
    def _calculate_stride_length(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate stride length in meters"""
        # MediaPipe pose landmarks: LEFT_ANKLE=27, RIGHT_ANKLE=28
        left_ankle = self._get_landmark(landmarks, 27, w, h)
        right_ankle = self._get_landmark(landmarks, 28, w, h)
        
        if left_ankle and right_ankle:
            # Calculate pixel distance
            pixel_dist = np.sqrt(
                (left_ankle[0] - right_ankle[0])**2 + 
                (left_ankle[1] - right_ankle[1])**2
            )
            
            # Estimate scale: use batter height
            # Average person height in pixels (rough estimate)
            # Use shoulder to hip distance as reference
            shoulder = self._get_landmark(landmarks, 11, w, h)
            hip = self._get_landmark(landmarks, 23, w, h)
            
            if shoulder and hip:
                ref_pixel_dist = np.sqrt(
                    (shoulder[0] - hip[0])**2 + 
                    (shoulder[1] - hip[1])**2
                )
                # Torso is roughly 0.4m
                if ref_pixel_dist > 0:
                    scale = 0.4 / ref_pixel_dist
                    stride_m = pixel_dist * scale
                    return float(stride_m)
        
        return None
    
    def _calculate_spine_tilt(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate spine tilt angle"""
        # MediaPipe pose landmarks: NOSE=0, MID_HIP (average of left/right hip)
        nose = self._get_landmark(landmarks, 0, w, h)
        left_hip = self._get_landmark(landmarks, 23, w, h)
        right_hip = self._get_landmark(landmarks, 24, w, h)
        
        if nose and left_hip and right_hip:
            mid_hip = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
            dx = mid_hip[0] - nose[0]
            dy = mid_hip[1] - nose[1]
            angle = np.degrees(np.arctan2(dx, dy)) - 90  # Adjust for vertical reference
            return float(angle)
        return None
    
    def _calculate_elbow_extension(self, landmarks: List, w: float, h: float) -> Optional[float]:
        """Calculate elbow extension angle"""
        # MediaPipe pose landmarks: LEFT_SHOULDER=11, LEFT_ELBOW=13, LEFT_WRIST=15
        shoulder = self._get_landmark(landmarks, 11, w, h)
        elbow = self._get_landmark(landmarks, 13, w, h)
        wrist = self._get_landmark(landmarks, 15, w, h)
        
        if shoulder and elbow and wrist:
            v1 = np.array([shoulder[0] - elbow[0], shoulder[1] - elbow[1]])
            v2 = np.array([wrist[0] - elbow[0], wrist[1] - elbow[1]])
            
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            angle = np.degrees(np.arccos(cos_angle))
            return float(angle)
        return None
    
    def _generate_feedback(self, metrics: Dict) -> List[str]:
        """Generate textual feedback based on form metrics"""
        feedback = []
        
        for metric_name, metric_data in metrics.items():
            if metric_name == 'feedback':
                continue
            
            value = metric_data.get('value')
            ideal = metric_data.get('ideal')
            deviation = metric_data.get('deviation', 0)
            
            if ideal and value is not None:
                ideal_min, ideal_max = ideal
                
                if value < ideal_min:
                    if metric_name == 'hip_rotation':
                        feedback.append("Hip rotation delayed - try closed-hip drills")
                    elif metric_name == 'shoulder_separation':
                        feedback.append("Shoulder separation could improve - focus on loading phase")
                    elif metric_name == 'front_knee_flex':
                        feedback.append("Front knee could be more flexed - improve weight transfer")
                
                if value > ideal_max:
                    if metric_name == 'spine_tilt':
                        feedback.append("Excessive spine tilt - maintain upright posture")
        
        if not feedback:
            feedback.append("Form looks good! Keep practicing.")
        
        return feedback

