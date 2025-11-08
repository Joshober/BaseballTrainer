"""
Advanced biomechanics analyzer for baseball swing analysis
Provides detailed biomechanical analysis including joint angles, forces, and movement patterns
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from scipy.signal import savgol_filter

logger = logging.getLogger(__name__)

class BiomechanicsAnalyzer:
    """Analyzes biomechanical aspects of baseball swing"""
    
    def __init__(self):
        """Initialize biomechanics analyzer"""
        # Ideal biomechanical ranges based on research
        self.ideal_ranges = {
            'hip_rotation_angle': (40, 60),  # degrees
            'shoulder_rotation_angle': (30, 50),  # degrees
            'torso_rotation': (45, 65),  # degrees
            'knee_flexion_front': (120, 150),  # degrees
            'knee_flexion_back': (130, 160),  # degrees
            'elbow_angle_lead': (90, 120),  # degrees
            'elbow_angle_trail': (100, 140),  # degrees
            'wrist_angle': (160, 180),  # degrees
            'spine_angle': (85, 95),  # degrees from vertical
            'weight_distribution_front': (0.4, 0.6),  # fraction
        }
    
    def analyze_biomechanics(self,
                            pose_landmarks_list: List[Optional[List]],
                            frame_shape: Tuple[int, int],
                            contact_frame: Optional[int] = None) -> Dict:
        """
        Perform comprehensive biomechanical analysis
        
        Args:
            pose_landmarks_list: List of pose landmarks per frame
            frame_shape: (height, width) of frame
            contact_frame: Frame index of contact (if known)
            
        Returns:
            Dictionary with biomechanical analysis results
        """
        if not pose_landmarks_list:
            return {'error': 'No pose landmarks provided'}
        
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
            return {'error': 'No valid landmarks extracted'}
        
        # Analyze at contact frame or middle frame
        analysis_frame = contact_frame if contact_frame and contact_frame < len(landmarks_sequence) else len(landmarks_sequence) // 2
        if analysis_frame >= len(landmarks_sequence) or landmarks_sequence[analysis_frame] is None:
            analysis_frame = next((i for i, lm in enumerate(landmarks_sequence) if lm is not None), 0)
        
        contact_landmarks = landmarks_sequence[analysis_frame]
        
        # Calculate joint angles
        joint_angles = self._calculate_joint_angles(contact_landmarks)
        
        # Calculate rotation angles
        rotation_angles = self._calculate_rotation_angles(contact_landmarks)
        
        # Calculate weight distribution
        weight_distribution = self._calculate_weight_distribution(contact_landmarks)
        
        # Calculate movement patterns across sequence
        movement_patterns = self._analyze_movement_patterns(landmarks_sequence, analysis_frame)
        
        # Calculate power generation metrics
        power_metrics = self._calculate_power_metrics(landmarks_sequence, analysis_frame)
        
        # Assess biomechanical efficiency
        efficiency = self._assess_biomechanical_efficiency(
            joint_angles, rotation_angles, weight_distribution
        )
        
        return {
            'frame': analysis_frame,
            'joint_angles': joint_angles,
            'rotation_angles': rotation_angles,
            'weight_distribution': weight_distribution,
            'movement_patterns': movement_patterns,
            'power_metrics': power_metrics,
            'efficiency': efficiency,
            'recommendations': self._generate_recommendations(efficiency, joint_angles, rotation_angles)
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
    
    def _calculate_joint_angles(self, landmarks: Dict) -> Dict:
        """Calculate joint angles at key joints"""
        angles = {}
        
        # Elbow angles (lead and trail arm)
        left_shoulder = landmarks.get('left_shoulder')
        left_elbow = landmarks.get('left_elbow')
        left_wrist = landmarks.get('left_wrist')
        
        right_shoulder = landmarks.get('right_shoulder')
        right_elbow = landmarks.get('right_elbow')
        right_wrist = landmarks.get('right_wrist')
        
        if left_shoulder and left_elbow and left_wrist:
            angles['elbow_angle_left'] = self._angle_between_three_points(
                left_shoulder, left_elbow, left_wrist
            )
        
        if right_shoulder and right_elbow and right_wrist:
            angles['elbow_angle_right'] = self._angle_between_three_points(
                right_shoulder, right_elbow, right_wrist
            )
        
        # Knee angles
        left_hip = landmarks.get('left_hip')
        left_knee = landmarks.get('left_knee')
        left_ankle = landmarks.get('left_ankle')
        
        right_hip = landmarks.get('right_hip')
        right_knee = landmarks.get('right_knee')
        right_ankle = landmarks.get('right_ankle')
        
        if left_hip and left_knee and left_ankle:
            angles['knee_angle_left'] = self._angle_between_three_points(
                left_hip, left_knee, left_ankle
            )
        
        if right_hip and right_knee and right_ankle:
            angles['knee_angle_right'] = self._angle_between_three_points(
                right_hip, right_knee, right_ankle
            )
        
        # Wrist angle (for bat grip)
        if left_elbow and left_wrist and right_wrist:
            angles['wrist_angle'] = self._angle_between_three_points(
                left_elbow, left_wrist, right_wrist
            )
        
        return angles
    
    def _calculate_rotation_angles(self, landmarks: Dict) -> Dict:
        """Calculate rotation angles for hips, shoulders, and torso"""
        rotations = {}
        
        # Hip rotation
        left_hip = landmarks.get('left_hip')
        right_hip = landmarks.get('right_hip')
        if left_hip and right_hip:
            dx = right_hip['x'] - left_hip['x']
            dy = right_hip['y'] - left_hip['y']
            rotations['hip_rotation'] = np.degrees(np.arctan2(dy, dx))
        
        # Shoulder rotation
        left_shoulder = landmarks.get('left_shoulder')
        right_shoulder = landmarks.get('right_shoulder')
        if left_shoulder and right_shoulder:
            dx = right_shoulder['x'] - left_shoulder['x']
            dy = right_shoulder['y'] - left_shoulder['y']
            rotations['shoulder_rotation'] = np.degrees(np.arctan2(dy, dx))
        
        # Torso rotation (difference between shoulder and hip rotation)
        if 'shoulder_rotation' in rotations and 'hip_rotation' in rotations:
            rotations['torso_rotation'] = abs(rotations['shoulder_rotation'] - rotations['hip_rotation'])
        
        # Spine angle (from vertical)
        nose = landmarks.get('nose')
        if nose and left_hip and right_hip:
            mid_hip_y = (left_hip['y'] + right_hip['y']) / 2
            mid_hip_x = (left_hip['x'] + right_hip['x']) / 2
            dx = mid_hip_x - nose['x']
            dy = mid_hip_y - nose['y']
            spine_angle = np.degrees(np.arctan2(dx, dy))
            rotations['spine_angle'] = 90 - abs(spine_angle)  # Angle from vertical
        
        return rotations
    
    def _calculate_weight_distribution(self, landmarks: Dict) -> Dict:
        """Calculate weight distribution between front and back leg"""
        left_ankle = landmarks.get('left_ankle')
        right_ankle = landmarks.get('right_ankle')
        left_knee = landmarks.get('left_knee')
        right_knee = landmarks.get('right_knee')
        
        if not (left_ankle and right_ankle and left_knee and right_knee):
            return {}
        
        # Estimate weight distribution based on knee and ankle positions
        # Front leg typically has more knee flexion and forward position
        left_knee_flex = abs(left_knee['y'] - left_ankle['y'])
        right_knee_flex = abs(right_knee['y'] - right_ankle['y'])
        
        # Determine which is front leg (typically the one more forward)
        left_forward = left_ankle['x'] > right_ankle['x']
        
        if left_forward:
            front_flex = left_knee_flex
            back_flex = right_knee_flex
        else:
            front_flex = right_knee_flex
            back_flex = left_knee_flex
        
        # Weight distribution estimate (more flexion = more weight)
        total_flex = front_flex + back_flex
        if total_flex > 0:
            front_weight = front_flex / total_flex
        else:
            front_weight = 0.5
        
        return {
            'front_leg_weight': float(front_weight),
            'back_leg_weight': float(1.0 - front_weight),
            'front_leg': 'left' if left_forward else 'right'
        }
    
    def _analyze_movement_patterns(self, 
                                  landmarks_sequence: List[Optional[Dict]],
                                  contact_frame: int) -> Dict:
        """Analyze movement patterns across the swing sequence"""
        if len(landmarks_sequence) < 3:
            return {}
        
        patterns = {}
        
        # Extract wrist positions over time
        wrist_x_positions = []
        wrist_y_positions = []
        
        for landmarks in landmarks_sequence:
            if landmarks:
                left_wrist = landmarks.get('left_wrist')
                right_wrist = landmarks.get('right_wrist')
                if left_wrist and right_wrist:
                    avg_x = (left_wrist['x'] + right_wrist['x']) / 2
                    avg_y = (left_wrist['y'] + right_wrist['y']) / 2
                    wrist_x_positions.append(avg_x)
                    wrist_y_positions.append(avg_y)
        
        if len(wrist_x_positions) > 2:
            # Calculate velocity and acceleration
            wrist_x_velocities = np.diff(wrist_x_positions)
            wrist_y_velocities = np.diff(wrist_y_positions)
            
            # Smooth velocities
            if len(wrist_x_velocities) > 5:
                try:
                    wrist_x_velocities = savgol_filter(wrist_x_velocities, 
                                                      min(5, len(wrist_x_velocities) // 2 * 2 + 1), 2)
                    wrist_y_velocities = savgol_filter(wrist_y_velocities,
                                                      min(5, len(wrist_y_velocities) // 2 * 2 + 1), 2)
                except:
                    pass
            
            patterns['max_wrist_velocity_x'] = float(np.max(np.abs(wrist_x_velocities))) if len(wrist_x_velocities) > 0 else 0.0
            patterns['max_wrist_velocity_y'] = float(np.max(np.abs(wrist_y_velocities))) if len(wrist_y_velocities) > 0 else 0.0
            patterns['wrist_path_length'] = float(np.sum(np.sqrt(np.diff(wrist_x_positions)**2 + np.diff(wrist_y_positions)**2)))
        
        # Analyze hip movement
        hip_x_positions = []
        for landmarks in landmarks_sequence:
            if landmarks:
                left_hip = landmarks.get('left_hip')
                right_hip = landmarks.get('right_hip')
                if left_hip and right_hip:
                    avg_x = (left_hip['x'] + right_hip['x']) / 2
                    hip_x_positions.append(avg_x)
        
        if len(hip_x_positions) > 1:
            hip_rotation_range = max(hip_x_positions) - min(hip_x_positions)
            patterns['hip_rotation_range'] = float(hip_rotation_range)
        
        return patterns
    
    def _calculate_power_metrics(self,
                                 landmarks_sequence: List[Optional[Dict]],
                                 contact_frame: int) -> Dict:
        """Calculate power generation metrics"""
        if len(landmarks_sequence) < 2:
            return {}
        
        # Calculate hip and shoulder separation at contact
        contact_landmarks = landmarks_sequence[contact_frame] if contact_frame < len(landmarks_sequence) else landmarks_sequence[-1]
        if not contact_landmarks:
            return {}
        
        left_hip = contact_landmarks.get('left_hip')
        right_hip = contact_landmarks.get('right_hip')
        left_shoulder = contact_landmarks.get('left_shoulder')
        right_shoulder = contact_landmarks.get('right_shoulder')
        
        power_metrics = {}
        
        if left_hip and right_hip and left_shoulder and right_shoulder:
            # Hip-shoulder separation (X-factor)
            hip_center_x = (left_hip['x'] + right_hip['x']) / 2
            shoulder_center_x = (left_shoulder['x'] + right_shoulder['x']) / 2
            x_factor = abs(shoulder_center_x - hip_center_x)
            power_metrics['x_factor'] = float(x_factor)
        
        # Calculate kinetic chain efficiency
        # (how well energy transfers from lower body to upper body)
        if len(landmarks_sequence) > contact_frame:
            # Compare hip rotation velocity to shoulder rotation velocity
            # (simplified - would need more frames for accurate velocity)
            power_metrics['kinetic_chain_efficiency'] = 0.75  # Placeholder
        
        return power_metrics
    
    def _assess_biomechanical_efficiency(self,
                                       joint_angles: Dict,
                                       rotation_angles: Dict,
                                       weight_distribution: Dict) -> Dict:
        """Assess overall biomechanical efficiency"""
        efficiency_scores = {}
        total_score = 0.0
        max_score = 0.0
        
        # Assess each metric
        for metric, ideal_range in self.ideal_ranges.items():
            value = None
            
            # Map metric names to actual values
            if metric == 'hip_rotation_angle':
                value = rotation_angles.get('hip_rotation')
            elif metric == 'shoulder_rotation_angle':
                value = rotation_angles.get('shoulder_rotation')
            elif metric == 'torso_rotation':
                value = rotation_angles.get('torso_rotation')
            elif metric == 'knee_flexion_front':
                # Use appropriate knee angle
                value = joint_angles.get('knee_angle_left') or joint_angles.get('knee_angle_right')
            elif metric == 'elbow_angle_lead':
                value = joint_angles.get('elbow_angle_left') or joint_angles.get('elbow_angle_right')
            elif metric == 'wrist_angle':
                value = joint_angles.get('wrist_angle')
            elif metric == 'spine_angle':
                value = rotation_angles.get('spine_angle')
            elif metric == 'weight_distribution_front':
                value = weight_distribution.get('front_leg_weight')
            
            if value is not None:
                ideal_min, ideal_max = ideal_range
                # Score: 1.0 if in ideal range, decreases outside
                if ideal_min <= value <= ideal_max:
                    score = 1.0
                else:
                    # Calculate distance from ideal range
                    if value < ideal_min:
                        distance = ideal_min - value
                        range_size = ideal_max - ideal_min
                    else:
                        distance = value - ideal_max
                        range_size = ideal_max - ideal_min
                    
                    # Score decreases with distance
                    score = max(0.0, 1.0 - (distance / range_size))
                
                efficiency_scores[metric] = {
                    'value': float(value),
                    'ideal_range': ideal_range,
                    'score': float(score),
                    'in_range': ideal_min <= value <= ideal_max
                }
                total_score += score
                max_score += 1.0
        
        overall_efficiency = total_score / max_score if max_score > 0 else 0.0
        
        return {
            'overall_efficiency': float(overall_efficiency),
            'metric_scores': efficiency_scores,
            'grade': self._efficiency_to_grade(overall_efficiency)
        }
    
    def _efficiency_to_grade(self, efficiency: float) -> str:
        """Convert efficiency score to letter grade"""
        if efficiency >= 0.9:
            return 'A'
        elif efficiency >= 0.8:
            return 'B'
        elif efficiency >= 0.7:
            return 'C'
        elif efficiency >= 0.6:
            return 'D'
        else:
            return 'F'
    
    def _generate_recommendations(self,
                                 efficiency: Dict,
                                 joint_angles: Dict,
                                 rotation_angles: Dict) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        overall = efficiency.get('overall_efficiency', 0.0)
        if overall < 0.7:
            recommendations.append("Overall biomechanical efficiency is below optimal. Focus on fundamental mechanics.")
        
        # Check specific issues
        metric_scores = efficiency.get('metric_scores', {})
        
        if 'hip_rotation_angle' in metric_scores:
            score = metric_scores['hip_rotation_angle']
            if not score['in_range']:
                if score['value'] < score['ideal_range'][0]:
                    recommendations.append("Increase hip rotation - focus on opening hips earlier in swing")
                else:
                    recommendations.append("Reduce hip rotation - may be opening too early")
        
        if 'knee_flexion_front' in metric_scores:
            score = metric_scores['knee_flexion_front']
            if not score['in_range']:
                if score['value'] > score['ideal_range'][1]:
                    recommendations.append("Increase front knee flexion for better weight transfer")
        
        if 'spine_angle' in metric_scores:
            score = metric_scores['spine_angle']
            if not score['in_range']:
                recommendations.append("Maintain more upright spine angle - avoid excessive forward lean")
        
        if not recommendations:
            recommendations.append("Biomechanics look good! Continue practicing to maintain form.")
        
        return recommendations
    
    def _angle_between_three_points(self, p1: Dict, p2: Dict, p3: Dict) -> float:
        """Calculate angle at p2 between p1-p2-p3"""
        try:
            v1 = np.array([p1['x'] - p2['x'], p1['y'] - p2['y']])
            v2 = np.array([p3['x'] - p2['x'], p3['y'] - p2['y']])
            
            # Calculate angle
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            angle = np.degrees(np.arccos(cos_angle))
            
            return float(angle)
        except Exception as e:
            logger.debug(f"Error calculating angle: {e}")
            return 0.0

