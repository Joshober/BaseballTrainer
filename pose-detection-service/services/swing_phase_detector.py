"""
Swing phase detection service for baseball swing analysis
Detects different phases of the swing: stance, load, stride, contact, follow-through
"""
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)

class SwingPhase(Enum):
    """Swing phases"""
    STANCE = "stance"
    LOAD = "load"
    STRIDE = "stride"
    CONTACT = "contact"
    FOLLOW_THROUGH = "follow_through"
    UNKNOWN = "unknown"

class SwingPhaseDetector:
    """Detects swing phases from pose landmarks and bat/ball positions"""
    
    def __init__(self):
        """Initialize swing phase detector"""
        self.phase_history: List[SwingPhase] = []
        self.frame_metrics_history: List[Dict] = []
    
    def detect_phase(self, 
                    pose_landmarks: Optional[List],
                    bat_angle: Optional[float],
                    bat_position: Optional[Tuple[float, float]],
                    ball_position: Optional[Dict],
                    frame_shape: Tuple[int, int],
                    frame_idx: int = 0) -> Dict:
        """
        Detect current swing phase from frame data
        
        Args:
            pose_landmarks: MediaPipe pose landmarks (list of dicts with x, y, z, visibility)
            bat_angle: Bat angle in degrees
            bat_position: Bat center position (x, y)
            ball_position: Ball detection result
            frame_shape: (height, width) of frame
            frame_idx: Current frame index
            
        Returns:
            Dictionary with phase detection results
        """
        if not pose_landmarks or len(pose_landmarks) < 20:
            return {
                'phase': SwingPhase.UNKNOWN.value,
                'confidence': 0.0,
                'frame': frame_idx
            }
        
        h, w = frame_shape[:2]
        
        # Extract key landmarks
        landmarks_dict = self._extract_landmarks(pose_landmarks, w, h)
        
        if not landmarks_dict:
            return {
                'phase': SwingPhase.UNKNOWN.value,
                'confidence': 0.0,
                'frame': frame_idx
            }
        
        # Calculate metrics for phase detection
        metrics = self._calculate_phase_metrics(landmarks_dict, bat_angle, bat_position, ball_position)
        
        # Store metrics for temporal analysis
        metrics['frame'] = frame_idx
        self.frame_metrics_history.append(metrics)
        if len(self.frame_metrics_history) > 30:  # Keep last 30 frames
            self.frame_metrics_history.pop(0)
        
        # Detect phase using multiple heuristics
        phase, confidence = self._classify_phase(metrics)
        
        # Store phase history
        self.phase_history.append(phase)
        if len(self.phase_history) > 10:
            self.phase_history.pop(0)
        
        return {
            'phase': phase.value,
            'confidence': confidence,
            'frame': frame_idx,
            'metrics': metrics
        }
    
    def detect_phases_sequence(self, 
                               pose_landmarks_list: List[Optional[List]],
                               bat_angles: List[Optional[float]],
                               bat_positions: List[Optional[Tuple[float, float]]],
                               ball_positions: List[Optional[Dict]],
                               frame_shape: Tuple[int, int],
                               contact_frame: Optional[int] = None) -> Dict:
        """
        Detect phases across entire swing sequence
        
        Args:
            pose_landmarks_list: List of pose landmarks per frame
            bat_angles: List of bat angles per frame
            bat_positions: List of bat positions per frame
            ball_positions: List of ball positions per frame
            frame_shape: (height, width) of frame
            contact_frame: Frame index of contact (if known)
            
        Returns:
            Dictionary with phase sequence analysis
        """
        phases = []
        phase_transitions = []
        
        for i in range(len(pose_landmarks_list)):
            result = self.detect_phase(
                pose_landmarks_list[i],
                bat_angles[i] if i < len(bat_angles) else None,
                bat_positions[i] if i < len(bat_positions) else None,
                ball_positions[i] if i < len(ball_positions) else None,
                frame_shape,
                i
            )
            phases.append(result)
            
            # Detect phase transitions
            if i > 0 and phases[i-1]['phase'] != result['phase']:
                phase_transitions.append({
                    'from': phases[i-1]['phase'],
                    'to': result['phase'],
                    'frame': i
                })
        
        # Identify key frames
        stance_frame = self._find_phase_frame(phases, SwingPhase.STANCE.value)
        load_frame = self._find_phase_frame(phases, SwingPhase.LOAD.value)
        stride_frame = self._find_phase_frame(phases, SwingPhase.STRIDE.value)
        contact_frame_detected = contact_frame or self._find_phase_frame(phases, SwingPhase.CONTACT.value)
        follow_through_frame = self._find_phase_frame(phases, SwingPhase.FOLLOW_THROUGH.value)
        
        return {
            'phases': phases,
            'phase_transitions': phase_transitions,
            'key_frames': {
                'stance': stance_frame,
                'load': load_frame,
                'stride': stride_frame,
                'contact': contact_frame_detected,
                'follow_through': follow_through_frame
            },
            'phase_duration': self._calculate_phase_durations(phases),
            'swing_quality': self._assess_swing_quality(phases, phase_transitions)
        }
    
    def _extract_landmarks(self, landmarks: List, w: float, h: float) -> Optional[Dict]:
        """Extract key landmarks from pose data"""
        try:
            # MediaPipe landmark indices
            landmark_map = {
                'nose': 0,
                'left_shoulder': 11,
                'right_shoulder': 12,
                'left_elbow': 13,
                'right_elbow': 14,
                'left_wrist': 15,
                'right_wrist': 16,
                'left_hip': 23,
                'right_hip': 24,
                'left_knee': 25,
                'right_knee': 26,
                'left_ankle': 27,
                'right_ankle': 28
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
            
            return result if len(result) >= 8 else None  # Need at least 8 key landmarks
            
        except Exception as e:
            logger.debug(f"Error extracting landmarks: {e}")
            return None
    
    def _calculate_phase_metrics(self, 
                                 landmarks: Dict,
                                 bat_angle: Optional[float],
                                 bat_position: Optional[Tuple[float, float]],
                                 ball_position: Optional[Dict]) -> Dict:
        """Calculate metrics used for phase detection"""
        metrics = {}
        
        # Wrist positions (key for phase detection)
        left_wrist = landmarks.get('left_wrist')
        right_wrist = landmarks.get('right_wrist')
        left_elbow = landmarks.get('left_elbow')
        right_elbow = landmarks.get('right_elbow')
        
        if left_wrist and right_wrist:
            # Average wrist height
            avg_wrist_y = (left_wrist['y'] + right_wrist['y']) / 2
            metrics['avg_wrist_y'] = avg_wrist_y
            
            # Wrist separation (horizontal)
            wrist_separation = abs(left_wrist['x'] - right_wrist['x'])
            metrics['wrist_separation'] = wrist_separation
            
            # Wrist forward position (for right-handed: right wrist forward = swing)
            metrics['wrist_forward'] = right_wrist['x'] if right_wrist else 0
        
        if left_elbow and right_elbow:
            avg_elbow_y = (left_elbow['y'] + right_elbow['y']) / 2
            metrics['avg_elbow_y'] = avg_elbow_y
            
            # Wrist relative to elbow (wrists above elbows = load phase)
            if left_wrist and right_wrist:
                metrics['wrists_above_elbows'] = avg_wrist_y < avg_elbow_y
        
        # Hip positions (for stride detection)
        left_hip = landmarks.get('left_hip')
        right_hip = landmarks.get('right_hip')
        if left_hip and right_hip:
            hip_separation = abs(left_hip['x'] - right_hip['x'])
            metrics['hip_separation'] = hip_separation
            metrics['hip_center_x'] = (left_hip['x'] + right_hip['x']) / 2
        
        # Knee positions (for stride)
        left_knee = landmarks.get('left_knee')
        right_knee = landmarks.get('right_knee')
        if left_knee and right_knee:
            knee_separation = abs(left_knee['x'] - right_knee['x'])
            metrics['knee_separation'] = knee_separation
        
        # Ankle positions (for stride length)
        left_ankle = landmarks.get('left_ankle')
        right_ankle = landmarks.get('right_ankle')
        if left_ankle and right_ankle:
            ankle_separation = abs(left_ankle['x'] - right_ankle['x'])
            metrics['ankle_separation'] = ankle_separation
            metrics['stride_length_pixels'] = ankle_separation
        
        # Bat metrics
        if bat_angle is not None:
            metrics['bat_angle'] = bat_angle
        if bat_position:
            metrics['bat_x'] = bat_position[0]
            metrics['bat_y'] = bat_position[1]
        
        # Ball metrics
        if ball_position and ball_position.get('center'):
            metrics['ball_x'] = ball_position['center'][0]
            metrics['ball_y'] = ball_position['center'][1]
            metrics['ball_detected'] = True
        else:
            metrics['ball_detected'] = False
        
        # Temporal metrics (if we have history)
        if len(self.frame_metrics_history) > 0:
            prev_metrics = self.frame_metrics_history[-1]
            if 'avg_wrist_y' in metrics and 'avg_wrist_y' in prev_metrics:
                metrics['wrist_y_velocity'] = metrics['avg_wrist_y'] - prev_metrics['avg_wrist_y']
            if 'bat_x' in metrics and 'bat_x' in prev_metrics:
                metrics['bat_x_velocity'] = metrics['bat_x'] - prev_metrics['bat_x']
        
        return metrics
    
    def _classify_phase(self, metrics: Dict) -> Tuple[SwingPhase, float]:
        """Classify phase based on metrics"""
        confidence = 0.0
        phase = SwingPhase.UNKNOWN
        
        # Check for contact phase (highest priority)
        if metrics.get('ball_detected') and metrics.get('bat_x'):
            ball_x = metrics.get('ball_x')
            bat_x = metrics.get('bat_x')
            if ball_x and bat_x:
                distance = abs(ball_x - bat_x)
                if distance < 50:  # Close proximity
                    phase = SwingPhase.CONTACT
                    confidence = 0.9
                    return phase, confidence
        
        # Check for follow-through (wrists forward, bat angle changed)
        wrist_forward = metrics.get('wrist_forward', 0)
        bat_angle = metrics.get('bat_angle')
        if wrist_forward > 0 and bat_angle is not None:
            # Check if we had contact recently
            if len(self.phase_history) > 0:
                recent_phases = [p for p in self.phase_history[-3:] if p != SwingPhase.UNKNOWN]
                if SwingPhase.CONTACT in recent_phases:
                    phase = SwingPhase.FOLLOW_THROUGH
                    confidence = 0.8
                    return phase, confidence
        
        # Check for stride (increased ankle/knee separation)
        ankle_sep = metrics.get('ankle_separation', 0)
        knee_sep = metrics.get('knee_separation', 0)
        if ankle_sep > 100 or knee_sep > 80:  # Significant separation
            phase = SwingPhase.STRIDE
            confidence = 0.7
            return phase, confidence
        
        # Check for load (wrists above elbows, high position)
        if metrics.get('wrists_above_elbows'):
            avg_wrist_y = metrics.get('avg_wrist_y', 0)
            avg_elbow_y = metrics.get('avg_elbow_y', 0)
            if avg_wrist_y < avg_elbow_y - 20:  # Significant difference
                phase = SwingPhase.LOAD
                confidence = 0.75
                return phase, confidence
        
        # Default to stance (initial position)
        if len(self.phase_history) == 0 or all(p == SwingPhase.STANCE for p in self.phase_history):
            phase = SwingPhase.STANCE
            confidence = 0.6
        else:
            # Use previous phase if uncertain
            if len(self.phase_history) > 0:
                phase = self.phase_history[-1]
                confidence = 0.5
        
        return phase, confidence
    
    def _find_phase_frame(self, phases: List[Dict], target_phase: str) -> Optional[int]:
        """Find first frame with target phase"""
        for phase_data in phases:
            if phase_data.get('phase') == target_phase:
                return phase_data.get('frame')
        return None
    
    def _calculate_phase_durations(self, phases: List[Dict]) -> Dict[str, float]:
        """Calculate duration of each phase in frames"""
        durations = {phase.value: 0 for phase in SwingPhase}
        
        for phase_data in phases:
            phase_name = phase_data.get('phase', 'unknown')
            if phase_name in durations:
                durations[phase_name] += 1
        
        return durations
    
    def _assess_swing_quality(self, phases: List[Dict], transitions: List[Dict]) -> Dict:
        """Assess swing quality based on phase sequence"""
        quality_metrics = {
            'has_all_phases': False,
            'phase_order_correct': False,
            'transition_smoothness': 0.0,
            'issues': []
        }
        
        # Check if all phases are present
        phase_names = [p['phase'] for p in phases]
        required_phases = [SwingPhase.STANCE.value, SwingPhase.LOAD.value, 
                          SwingPhase.CONTACT.value, SwingPhase.FOLLOW_THROUGH.value]
        quality_metrics['has_all_phases'] = all(phase in phase_names for phase in required_phases)
        
        # Check phase order
        phase_order = [p['phase'] for p in phases if p['phase'] != SwingPhase.UNKNOWN.value]
        if len(phase_order) >= 3:
            # Should go: stance -> load -> contact -> follow_through
            has_stance_before_load = False
            has_load_before_contact = False
            has_contact_before_follow = False
            
            for i, phase in enumerate(phase_order):
                if phase == SwingPhase.STANCE.value:
                    if any(phase_order[j] == SwingPhase.LOAD.value for j in range(i+1, len(phase_order))):
                        has_stance_before_load = True
                if phase == SwingPhase.LOAD.value:
                    if any(phase_order[j] == SwingPhase.CONTACT.value for j in range(i+1, len(phase_order))):
                        has_load_before_contact = True
                if phase == SwingPhase.CONTACT.value:
                    if any(phase_order[j] == SwingPhase.FOLLOW_THROUGH.value for j in range(i+1, len(phase_order))):
                        has_contact_before_follow = True
            
            quality_metrics['phase_order_correct'] = (
                has_stance_before_load and has_load_before_contact and has_contact_before_follow
            )
        
        # Assess transition smoothness
        if len(transitions) > 0:
            # Fewer transitions = smoother (but need at least some)
            transition_count = len(transitions)
            quality_metrics['transition_smoothness'] = max(0.0, 1.0 - (transition_count - 3) / 10.0)
        else:
            quality_metrics['issues'].append("No phase transitions detected")
        
        return quality_metrics

