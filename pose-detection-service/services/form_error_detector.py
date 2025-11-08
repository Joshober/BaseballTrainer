"""
Form error detection service for baseball swing analysis
Detects specific form errors and provides corrective feedback
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)

class FormError(Enum):
    """Types of form errors"""
    EARLY_HIP_ROTATION = "early_hip_rotation"
    LATE_HIP_ROTATION = "late_hip_rotation"
    OVERSTRIDE = "overstride"
    UNDERSTRIDE = "understride"
    COLLAPSING_FRONT_LEG = "collapsing_front_leg"
    UPRIGHT_FRONT_LEG = "upright_front_leg"
    CHICKEN_WING = "chicken_wing"  # Elbow flying out
    CASTING = "casting"  # Early extension of arms
    DROPPING_HANDS = "dropping_hands"
    LIFTING_HANDS = "lifting_hands"
    SPINE_TILT_EXCESSIVE = "spine_tilt_excessive"
    WEIGHT_ON_BACK_FOOT = "weight_on_back_foot"
    NO_SEPARATION = "no_separation"  # No hip-shoulder separation
    OVER_ROTATION = "over_rotation"
    UNDER_ROTATION = "under_rotation"
    NONE = "none"

class FormErrorDetector:
    """Detects specific form errors in baseball swing"""
    
    def __init__(self):
        """Initialize form error detector"""
        # Thresholds for error detection
        self.thresholds = {
            'hip_rotation_early': 0.3,  # Fraction of swing before hip rotation
            'hip_rotation_late': 0.7,  # Fraction of swing before hip rotation
            'stride_length_min': 0.2,  # meters
            'stride_length_max': 0.6,  # meters
            'front_knee_flex_min': 120,  # degrees
            'front_knee_flex_max': 150,  # degrees
            'elbow_angle_min': 90,  # degrees (chicken wing detection)
            'spine_tilt_max': 15,  # degrees from vertical
            'hand_drop_threshold': 50,  # pixels
            'separation_min': 30,  # pixels (hip-shoulder separation)
        }
    
    def detect_errors(self,
                     pose_landmarks_list: List[Optional[List]],
                     bat_angles: List[Optional[float]],
                     bat_positions: List[Optional[Tuple[float, float]]],
                     frame_shape: Tuple[int, int],
                     contact_frame: Optional[int] = None,
                     fps: float = 30.0) -> Dict:
        """
        Detect form errors across swing sequence
        
        Args:
            pose_landmarks_list: List of pose landmarks per frame
            bat_angles: List of bat angles per frame
            bat_positions: List of bat positions per frame
            frame_shape: (height, width) of frame
            contact_frame: Frame index of contact
            fps: Frames per second
            
        Returns:
            Dictionary with detected errors and recommendations
        """
        if not pose_landmarks_list:
            return {'errors': [], 'error_count': 0}
        
        h, w = frame_shape[:2]
        
        # Extract landmarks for all frames
        landmarks_sequence = []
        for landmarks in pose_landmarks_list:
            if landmarks:
                extracted = self._extract_landmarks(landmarks, w, h)
                if extracted:
                    landmarks_sequence.append(extracted)
            else:
                landmarks_sequence.append(None)
        
        if not landmarks_sequence:
            return {'errors': [], 'error_count': 0}
        
        # Determine contact frame
        if contact_frame is None or contact_frame >= len(landmarks_sequence):
            contact_frame = len(landmarks_sequence) // 2
        
        errors = []
        
        # Detect various errors
        errors.extend(self._detect_hip_rotation_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_stride_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_knee_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_elbow_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_hand_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_spine_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_weight_distribution_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_separation_errors(landmarks_sequence, contact_frame))
        errors.extend(self._detect_rotation_errors(landmarks_sequence, contact_frame))
        
        # Remove duplicates and sort by severity
        unique_errors = self._deduplicate_errors(errors)
        unique_errors.sort(key=lambda e: e.get('severity', 0), reverse=True)
        
        return {
            'errors': unique_errors,
            'error_count': len(unique_errors),
            'severity_score': self._calculate_severity_score(unique_errors),
            'recommendations': self._generate_error_recommendations(unique_errors)
        }
    
    def _extract_landmarks(self, landmarks: List, w: float, h: float) -> Optional[Dict]:
        """Extract key landmarks from pose data"""
        try:
            landmark_map = {
                'nose': 0,
                'left_shoulder': 11, 'right_shoulder': 12,
                'left_elbow': 13, 'right_elbow': 14,
                'left_wrist': 15, 'right_wrist': 16,
                'left_hip': 23, 'right_hip': 24,
                'left_knee': 25, 'right_knee': 26,
                'left_ankle': 27, 'right_ankle': 28
            }
            
            result = {}
            for name, idx in landmark_map.items():
                if idx < len(landmarks):
                    lm = landmarks[idx]
                    if isinstance(lm, dict):
                        result[name] = {
                            'x': lm['x'] * w,
                            'y': lm['y'] * h,
                            'z': lm.get('z', 0),
                            'visibility': lm.get('visibility', 1.0)
                        }
                    elif hasattr(lm, 'x'):
                        result[name] = {
                            'x': lm.x * w,
                            'y': lm.y * h,
                            'z': getattr(lm, 'z', 0),
                            'visibility': getattr(lm, 'visibility', 1.0)
                        }
            
            return result if len(result) >= 10 else None
            
        except Exception as e:
            logger.debug(f"Error extracting landmarks: {e}")
            return None
    
    def _detect_hip_rotation_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect early or late hip rotation"""
        errors = []
        
        if contact_frame < 2:
            return errors
        
        # Calculate hip rotation over time
        hip_rotations = []
        for landmarks in landmarks_sequence[:contact_frame+1]:
            if landmarks:
                left_hip = landmarks.get('left_hip')
                right_hip = landmarks.get('right_hip')
                if left_hip and right_hip:
                    dx = right_hip['x'] - left_hip['x']
                    dy = right_hip['y'] - left_hip['y']
                    angle = np.degrees(np.arctan2(dy, dx))
                    hip_rotations.append(angle)
        
        if len(hip_rotations) < 3:
            return errors
        
        # Find when significant hip rotation starts
        initial_rotation = hip_rotations[0]
        rotation_changes = [abs(hip_rotations[i] - initial_rotation) for i in range(1, len(hip_rotations))]
        
        if len(rotation_changes) > 0:
            max_change = max(rotation_changes)
            if max_change > 10:  # Significant rotation
                rotation_start_frame = rotation_changes.index(max(rotation_changes[:len(rotation_changes)//2])) + 1
                rotation_timing = rotation_start_frame / len(hip_rotations)
                
                if rotation_timing < self.thresholds['hip_rotation_early']:
                    errors.append({
                        'error': FormError.EARLY_HIP_ROTATION.value,
                        'severity': 2,
                        'frame': rotation_start_frame,
                        'description': 'Hip rotation starting too early in swing',
                        'impact': 'Reduces power generation and timing'
                    })
                elif rotation_timing > self.thresholds['hip_rotation_late']:
                    errors.append({
                        'error': FormError.LATE_HIP_ROTATION.value,
                        'severity': 2,
                        'frame': rotation_start_frame,
                        'description': 'Hip rotation starting too late in swing',
                        'impact': 'Reduces power and bat speed'
                    })
        
        return errors
    
    def _detect_stride_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect overstride or understride"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        left_ankle = contact_landmarks.get('left_ankle')
        right_ankle = contact_landmarks.get('right_ankle')
        
        if not (left_ankle and right_ankle):
            return errors
        
        # Calculate stride length (in pixels, approximate)
        stride_pixels = abs(left_ankle['x'] - right_ankle['x'])
        
        # Estimate scale (rough approximation using body height)
        # Average person height ~1.75m, stride should be ~0.3-0.5m
        # Estimate pixels per meter (rough: assume person is ~600 pixels tall)
        estimated_height_pixels = 600  # Rough estimate
        pixels_per_meter = estimated_height_pixels / 1.75
        stride_meters = stride_pixels / pixels_per_meter
        
        if stride_meters > self.thresholds['stride_length_max']:
            errors.append({
                'error': FormError.OVERSTRIDE.value,
                'severity': 2,
                'frame': contact_frame,
                'description': f'Stride length ({stride_meters:.2f}m) is too long',
                'impact': 'Reduces balance and power transfer'
            })
        elif stride_meters < self.thresholds['stride_length_min']:
            errors.append({
                'error': FormError.UNDERSTRIDE.value,
                'severity': 1,
                'frame': contact_frame,
                'description': f'Stride length ({stride_meters:.2f}m) is too short',
                'impact': 'Limits power generation'
            })
        
        return errors
    
    def _detect_knee_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect front leg collapsing or staying too upright"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        left_hip = contact_landmarks.get('left_hip')
        left_knee = contact_landmarks.get('left_knee')
        left_ankle = contact_landmarks.get('left_ankle')
        right_hip = contact_landmarks.get('right_hip')
        right_knee = contact_landmarks.get('right_knee')
        right_ankle = contact_landmarks.get('right_ankle')
        
        # Determine front leg (the one more forward)
        if left_ankle and right_ankle:
            front_is_left = left_ankle['x'] > right_ankle['x']
            
            if front_is_left and left_hip and left_knee and left_ankle:
                knee_angle = self._angle_between_three_points(left_hip, left_knee, left_ankle)
            elif not front_is_left and right_hip and right_knee and right_ankle:
                knee_angle = self._angle_between_three_points(right_hip, right_knee, right_ankle)
            else:
                return errors
            
            if knee_angle < self.thresholds['front_knee_flex_min']:
                errors.append({
                    'error': FormError.COLLAPSING_FRONT_LEG.value,
                    'severity': 2,
                    'frame': contact_frame,
                    'description': f'Front knee collapsing (angle: {knee_angle:.1f}°)',
                    'impact': 'Reduces power and stability'
                })
            elif knee_angle > self.thresholds['front_knee_flex_max']:
                errors.append({
                    'error': FormError.UPRIGHT_FRONT_LEG.value,
                    'severity': 1,
                    'frame': contact_frame,
                    'description': f'Front leg too upright (angle: {knee_angle:.1f}°)',
                    'impact': 'Limits weight transfer'
                })
        
        return errors
    
    def _detect_elbow_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect chicken wing (elbow flying out) or casting (early extension)"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        # Check for chicken wing (elbow angle too small)
        left_shoulder = contact_landmarks.get('left_shoulder')
        left_elbow = contact_landmarks.get('left_elbow')
        left_wrist = contact_landmarks.get('left_wrist')
        
        right_shoulder = contact_landmarks.get('right_shoulder')
        right_elbow = contact_landmarks.get('right_elbow')
        right_wrist = contact_landmarks.get('right_wrist')
        
        # Check lead arm (typically right arm for right-handed)
        if right_shoulder and right_elbow and right_wrist:
            elbow_angle = self._angle_between_three_points(right_shoulder, right_elbow, right_wrist)
            
            if elbow_angle < self.thresholds['elbow_angle_min']:
                errors.append({
                    'error': FormError.CHICKEN_WING.value,
                    'severity': 2,
                    'frame': contact_frame,
                    'description': f'Chicken wing detected (elbow angle: {elbow_angle:.1f}°)',
                    'impact': 'Reduces bat speed and power'
                })
        
        # Check for casting (early extension) - compare to earlier frames
        if contact_frame > 2:
            earlier_landmarks = landmarks_sequence[contact_frame - 3]
            if earlier_landmarks and right_shoulder and right_elbow and right_wrist:
                earlier_elbow = earlier_landmarks.get('right_elbow')
                if earlier_elbow:
                    # Check if elbow extended too early (moved too far from body)
                    earlier_distance = np.sqrt((earlier_elbow['x'] - right_shoulder['x'])**2 + 
                                              (earlier_elbow['y'] - right_shoulder['y'])**2)
                    current_distance = np.sqrt((right_elbow['x'] - right_shoulder['x'])**2 + 
                                              (right_elbow['y'] - right_shoulder['y'])**2)
                    
                    if current_distance > earlier_distance * 1.3:  # Significant extension
                        errors.append({
                            'error': FormError.CASTING.value,
                            'severity': 2,
                            'frame': contact_frame,
                            'description': 'Early arm extension (casting) detected',
                            'impact': 'Reduces bat speed and contact quality'
                        })
        
        return errors
    
    def _detect_hand_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect dropping or lifting hands"""
        errors = []
        
        if contact_frame < 2:
            return errors
        
        contact_landmarks = landmarks_sequence[contact_frame]
        if not contact_landmarks:
            return errors
        
        # Compare hand position to earlier in swing
        earlier_landmarks = landmarks_sequence[max(0, contact_frame - 5)]
        if not earlier_landmarks:
            return errors
        
        contact_left_wrist = contact_landmarks.get('left_wrist')
        contact_right_wrist = contact_landmarks.get('right_wrist')
        earlier_left_wrist = earlier_landmarks.get('left_wrist')
        earlier_right_wrist = earlier_landmarks.get('right_wrist')
        
        if (contact_left_wrist and contact_right_wrist and 
            earlier_left_wrist and earlier_right_wrist):
            
            contact_avg_y = (contact_left_wrist['y'] + contact_right_wrist['y']) / 2
            earlier_avg_y = (earlier_left_wrist['y'] + earlier_right_wrist['y']) / 2
            
            hand_drop = contact_avg_y - earlier_avg_y  # Positive = dropped
            
            if hand_drop > self.thresholds['hand_drop_threshold']:
                errors.append({
                    'error': FormError.DROPPING_HANDS.value,
                    'severity': 2,
                    'frame': contact_frame,
                    'description': 'Hands dropping during swing',
                    'impact': 'Reduces bat path and contact quality'
                })
            elif hand_drop < -self.thresholds['hand_drop_threshold']:
                errors.append({
                    'error': FormError.LIFTING_HANDS.value,
                    'severity': 1,
                    'frame': contact_frame,
                    'description': 'Hands lifting during swing',
                    'impact': 'May cause pop-ups or weak contact'
                })
        
        return errors
    
    def _detect_spine_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect excessive spine tilt"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        nose = contact_landmarks.get('nose')
        left_hip = contact_landmarks.get('left_hip')
        right_hip = contact_landmarks.get('right_hip')
        
        if nose and left_hip and right_hip:
            mid_hip_y = (left_hip['y'] + right_hip['y']) / 2
            mid_hip_x = (left_hip['x'] + right_hip['x']) / 2
            
            dx = mid_hip_x - nose['x']
            dy = mid_hip_y - nose['y']
            spine_angle = 90 - abs(np.degrees(np.arctan2(dx, dy)))
            
            if abs(spine_angle) > self.thresholds['spine_tilt_max']:
                errors.append({
                    'error': FormError.SPINE_TILT_EXCESSIVE.value,
                    'severity': 2,
                    'frame': contact_frame,
                    'description': f'Excessive spine tilt ({spine_angle:.1f}°)',
                    'impact': 'Reduces balance and power transfer'
                })
        
        return errors
    
    def _detect_weight_distribution_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect weight distribution issues"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        left_knee = contact_landmarks.get('left_knee')
        right_knee = contact_landmarks.get('right_knee')
        left_ankle = contact_landmarks.get('left_ankle')
        right_ankle = contact_landmarks.get('right_ankle')
        
        if not (left_knee and right_knee and left_ankle and right_ankle):
            return errors
        
        # Estimate weight distribution from knee flexion
        left_flex = abs(left_knee['y'] - left_ankle['y'])
        right_flex = abs(right_knee['y'] - right_ankle['y'])
        total_flex = left_flex + right_flex
        
        if total_flex > 0:
            back_leg_weight = min(left_flex, right_flex) / total_flex
            
            if back_leg_weight > 0.6:  # Too much weight on back leg
                errors.append({
                    'error': FormError.WEIGHT_ON_BACK_FOOT.value,
                    'severity': 2,
                    'frame': contact_frame,
                    'description': 'Too much weight on back foot at contact',
                    'impact': 'Reduces power transfer and bat speed'
                })
        
        return errors
    
    def _detect_separation_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect lack of hip-shoulder separation (X-factor)"""
        errors = []
        
        # Check earlier in swing (during load phase)
        load_frame = max(0, contact_frame - 5)
        load_landmarks = landmarks_sequence[load_frame] if load_frame < len(landmarks_sequence) else None
        
        if not load_landmarks:
            return errors
        
        left_hip = load_landmarks.get('left_hip')
        right_hip = load_landmarks.get('right_hip')
        left_shoulder = load_landmarks.get('left_shoulder')
        right_shoulder = load_landmarks.get('right_shoulder')
        
        if not (left_hip and right_hip and left_shoulder and right_shoulder):
            return errors
        
        hip_center_x = (left_hip['x'] + right_hip['x']) / 2
        shoulder_center_x = (left_shoulder['x'] + right_shoulder['x']) / 2
        separation = abs(shoulder_center_x - hip_center_x)
        
        if separation < self.thresholds['separation_min']:
            errors.append({
                'error': FormError.NO_SEPARATION.value,
                'severity': 2,
                'frame': load_frame,
                'description': 'Insufficient hip-shoulder separation (X-factor)',
                'impact': 'Significantly reduces power generation'
            })
        
        return errors
    
    def _detect_rotation_errors(self, landmarks_sequence: List[Optional[Dict]], contact_frame: int) -> List[Dict]:
        """Detect over or under rotation"""
        errors = []
        
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return errors
        
        left_shoulder = contact_landmarks.get('left_shoulder')
        right_shoulder = contact_landmarks.get('right_shoulder')
        
        if not (left_shoulder and right_shoulder):
            return errors
        
        # Calculate shoulder rotation angle
        dx = right_shoulder['x'] - left_shoulder['x']
        dy = right_shoulder['y'] - left_shoulder['y']
        rotation_angle = np.degrees(np.arctan2(dy, dx))
        
        # Ideal rotation is around 45-60 degrees at contact
        if rotation_angle > 70:
            errors.append({
                'error': FormError.OVER_ROTATION.value,
                'severity': 1,
                'frame': contact_frame,
                'description': f'Over-rotation detected ({rotation_angle:.1f}°)',
                'impact': 'May cause timing issues'
            })
        elif rotation_angle < 20:
            errors.append({
                'error': FormError.UNDER_ROTATION.value,
                'severity': 2,
                'frame': contact_frame,
                'description': f'Under-rotation detected ({rotation_angle:.1f}°)',
                'impact': 'Reduces power and bat speed'
            })
        
        return errors
    
    def _deduplicate_errors(self, errors: List[Dict]) -> List[Dict]:
        """Remove duplicate errors"""
        seen = set()
        unique = []
        for error in errors:
            error_type = error.get('error')
            if error_type and error_type not in seen:
                seen.add(error_type)
                unique.append(error)
        return unique
    
    def _calculate_severity_score(self, errors: List[Dict]) -> float:
        """Calculate overall severity score (0-1, higher = more severe)"""
        if not errors:
            return 0.0
        
        total_severity = sum(e.get('severity', 0) for e in errors)
        max_severity = len(errors) * 3  # Max severity per error is 3
        
        return min(1.0, total_severity / max_severity if max_severity > 0 else 0.0)
    
    def _generate_error_recommendations(self, errors: List[Dict]) -> List[str]:
        """Generate specific recommendations for each error"""
        recommendations = []
        
        error_recommendations = {
            FormError.EARLY_HIP_ROTATION.value: "Focus on keeping hips closed longer. Practice drills that emphasize hip separation.",
            FormError.LATE_HIP_ROTATION.value: "Start hip rotation earlier in the swing. Work on timing and sequence.",
            FormError.OVERSTRIDE.value: "Reduce stride length. Focus on shorter, controlled stride.",
            FormError.UNDERSTRIDE.value: "Increase stride length slightly for better weight transfer.",
            FormError.COLLAPSING_FRONT_LEG.value: "Maintain front leg strength. Practice balance drills.",
            FormError.UPRIGHT_FRONT_LEG.value: "Increase front knee flexion for better weight transfer.",
            FormError.CHICKEN_WING.value: "Keep lead elbow close to body. Practice one-handed drills.",
            FormError.CASTING.value: "Maintain arm angle longer. Focus on keeping hands inside the ball.",
            FormError.DROPPING_HANDS.value: "Keep hands at consistent height. Practice tee work focusing on hand path.",
            FormError.LIFTING_HANDS.value: "Maintain level swing path. Avoid lifting hands during swing.",
            FormError.SPINE_TILT_EXCESSIVE.value: "Maintain upright posture. Focus on core strength.",
            FormError.WEIGHT_ON_BACK_FOOT.value: "Transfer weight to front foot. Practice weight transfer drills.",
            FormError.NO_SEPARATION.value: "Create more hip-shoulder separation. This is critical for power.",
            FormError.OVER_ROTATION.value: "Control rotation. Focus on staying balanced.",
            FormError.UNDER_ROTATION.value: "Increase rotation for more power. Work on hip and shoulder turn."
        }
        
        for error in errors:
            error_type = error.get('error')
            if error_type in error_recommendations:
                recommendations.append(error_recommendations[error_type])
        
        if not recommendations:
            recommendations.append("No major form errors detected. Continue practicing to maintain good mechanics.")
        
        return recommendations
    
    def _angle_between_three_points(self, p1: Dict, p2: Dict, p3: Dict) -> float:
        """Calculate angle at p2 between p1-p2-p3"""
        try:
            v1 = np.array([p1['x'] - p2['x'], p1['y'] - p2['y']])
            v2 = np.array([p3['x'] - p2['x'], p3['y'] - p2['y']])
            
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            angle = np.degrees(np.arccos(cos_angle))
            
            return float(angle)
        except Exception as e:
            logger.debug(f"Error calculating angle: {e}")
            return 0.0

