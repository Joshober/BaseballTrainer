"""
Video analyzer service for baseball swing analysis
Processes video frames and performs comprehensive swing analysis
"""
import cv2
import numpy as np
import logging
import tempfile
import os
from typing import Dict, List, Optional, Tuple, Any
from io import BytesIO

from services.pose_detector import PoseDetector
from services.person_detector import PersonDetector
from services.bat_detector import BatDetector
from services.ball_detector import BallDetector
from services.contact_detector import ContactDetector
from services.metrics_calculator import MetricsCalculator
from services.swing_phase_detector import SwingPhaseDetector
from services.biomechanics_analyzer import BiomechanicsAnalyzer
from services.form_error_detector import FormErrorDetector
from services.tracking_coordinator import TrackingCoordinator

logger = logging.getLogger(__name__)

class VideoAnalyzer:
    """Analyzes baseball swing videos frame by frame"""
    
    def __init__(self, 
                 processing_mode: str = 'full',
                 sample_rate: int = 1,
                 max_frames: Optional[int] = None,
                 enable_yolo: bool = True,
                 yolo_confidence: float = 0.5,
                 batter_height_m: Optional[float] = None,
                 use_tracking_coordinator: bool = True):
        """
        Initialize video analyzer
        
        Args:
            processing_mode: 'full', 'sampled', or 'streaming'
            sample_rate: Process every Nth frame (for sampled mode)
            max_frames: Maximum frames to process
            enable_yolo: Use YOLOv8 for bat/ball detection
            yolo_confidence: YOLO detection confidence threshold
            batter_height_m: Batter height in meters for calibration
            use_tracking_coordinator: Whether to use advanced tracking coordinator
        """
        self.processing_mode = processing_mode
        self.sample_rate = sample_rate
        self.max_frames = max_frames
        self.enable_yolo = enable_yolo
        self.yolo_confidence = yolo_confidence
        self.use_tracking_coordinator = use_tracking_coordinator
        
        # Initialize services
        self.pose_detector = PoseDetector()
        self.person_detector = PersonDetector()
        self.bat_detector = BatDetector(use_yolo=enable_yolo, yolo_confidence=yolo_confidence, 
                                        use_advanced_tracking=use_tracking_coordinator)
        self.ball_detector = BallDetector(use_yolo=enable_yolo, yolo_confidence=yolo_confidence,
                                         use_advanced_tracking=use_tracking_coordinator)
        self.contact_detector = ContactDetector()
        self.metrics_calculator = MetricsCalculator(batter_height_m=batter_height_m)
        self.swing_phase_detector = SwingPhaseDetector()
        self.biomechanics_analyzer = BiomechanicsAnalyzer()
        self.form_error_detector = FormErrorDetector()
        
        # Initialize tracking coordinator if enabled
        self.tracking_coordinator = None
        if use_tracking_coordinator:
            try:
                self.tracking_coordinator = TrackingCoordinator(use_kalman=True)
                logger.info("Tracking coordinator initialized")
            except Exception as e:
                logger.warning(f"Could not initialize tracking coordinator: {e}")
                self.tracking_coordinator = None
    
    def analyze_video(self, video_bytes: bytes, filename: str = 'video.mp4') -> Dict:
        """
        Analyze video file from bytes
        
        Args:
            video_bytes: Video file bytes
            filename: Original filename
            
        Returns:
            Dictionary with analysis results
        """
        # Save video to temporary file
        temp_file = None
        try:
            # Create temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix='.mp4')
            temp_file = temp_path
            
            # Write video bytes to temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(video_bytes)
            
            # Analyze from file path
            return self.analyze_video_from_path(temp_path, filename)
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {temp_file}: {e}")
    
    def analyze_video_from_path(self, video_path: str, filename: str = 'video.mp4') -> Dict:
        """
        Analyze video file from file system path
        
        Args:
            video_path: Path to video file on file system
            filename: Original filename (for metadata)
            
        Returns:
            Dictionary with analysis results
        """
        try:
            # Open video with OpenCV
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                return {
                    'ok': False,
                    'error': 'Could not open video file'
                }
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = frame_count / fps if fps > 0 else 0
            
            # Process frames
            frames_data = []
            bat_angles = []
            bat_positions = []
            ball_positions = []
            pose_landmarks_list = []
            
            frame_idx = 0
            processed_frames = 0
            prev_ball_position: Optional[Tuple[float, float]] = None  # Kept for backward compatibility
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Apply frame sampling if needed
                if self.processing_mode == 'sampled':
                    if frame_idx % self.sample_rate != 0:
                        frame_idx += 1
                        continue
                
                # Check max frames limit
                if self.max_frames and processed_frames >= self.max_frames:
                    break
                
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Process frame (tracking is now handled internally by BallDetector)
                frame_result = self._process_frame(
                    frame_rgb,
                    frame_idx,
                    fps,
                    (height, width),
                    prev_ball_position
                )
                
                # Update previous ball position for next frame (for backward compatibility)
                # Note: BallDetector now uses Kalman Filter internally, but we keep this for compatibility
                if frame_result and frame_result.get('ball') and frame_result['ball'].get('center'):
                    prev_ball_position = tuple(frame_result['ball']['center'])
                
                if frame_result:
                    frames_data.append(frame_result)
                    
                    # Collect data for contact detection
                    if frame_result.get('bat_angle') is not None:
                        bat_angles.append(frame_result['bat_angle'])
                        bat_pos = frame_result.get('bat_position')
                        if bat_pos:
                            bat_positions.append((bat_pos[0], bat_pos[1]))
                        else:
                            bat_positions.append(None)
                    else:
                        bat_angles.append(None)
                        bat_positions.append(None)
                    
                    ball_positions.append(frame_result.get('ball'))
                    pose_landmarks_list.append(frame_result.get('pose_landmarks'))
                
                processed_frames += 1
                frame_idx += 1
            
            cap.release()
            
            # Detect contact
            contact_result = self.contact_detector.detect_contact(
                bat_angles,
                bat_positions,
                ball_positions,
                fps
            )
            
            # Calculate aggregated metrics
            contact_frame = contact_result['frame'] if contact_result else None
            metrics = self._calculate_aggregated_metrics(
                bat_angles,
                ball_positions,
                contact_frame,
                fps,
                pose_landmarks_list,
                (height, width)
            )
            
            # Calculate form analysis
            form_analysis = self.metrics_calculator.calculate_form_metrics(
                pose_landmarks_list,
                (height, width)
            )
            
            # Detect swing phases
            swing_phases = None
            try:
                swing_phases = self.swing_phase_detector.detect_phases_sequence(
                    pose_landmarks_list,
                    bat_angles,
                    bat_positions,
                    ball_positions,
                    (height, width),
                    contact_frame
                )
            except Exception as e:
                logger.warning(f"Swing phase detection error: {e}")
            
            # Analyze biomechanics
            biomechanics = None
            try:
                biomechanics = self.biomechanics_analyzer.analyze_biomechanics(
                    pose_landmarks_list,
                    (height, width),
                    contact_frame
                )
            except Exception as e:
                logger.warning(f"Biomechanics analysis error: {e}")
            
            # Detect form errors
            form_errors = None
            try:
                form_errors = self.form_error_detector.detect_errors(
                    pose_landmarks_list,
                    bat_angles,
                    bat_positions,
                    (height, width),
                    contact_frame,
                    fps
                )
            except Exception as e:
                logger.warning(f"Form error detection error: {e}")
            
            # Get tracking trajectories if coordinator is available
            tracking_trajectories = None
            tracking_quality = None
            if self.tracking_coordinator:
                try:
                    tracking_trajectories = self.tracking_coordinator.get_trajectories(num_frames=min(30, len(frames_data)))
                    coordinator_quality = self.tracking_coordinator._assess_tracking_quality()
                    # Normalize field names from coordinator
                    if coordinator_quality:
                        tracking_quality = {
                            'overallScore': coordinator_quality.get('score', 0.0),
                            'personTrackingRatio': coordinator_quality.get('person_tracking_ratio', 0.0),
                            'batTrackingRatio': coordinator_quality.get('bat_tracking_ratio', 0.0),
                            'ballTrackingRatio': coordinator_quality.get('ball_tracking_ratio', 0.0),
                            'issues': coordinator_quality.get('issues', [])
                        }
                except Exception as e:
                    logger.debug(f"Error getting tracking trajectories: {e}")
            
            # Calculate tracking quality from actual frame data if coordinator didn't provide it or score is 0
            if not tracking_quality or tracking_quality.get('overallScore', 0) == 0:
                frame_based_quality = self._calculate_tracking_quality_from_frames(
                    frames_data, len(pose_landmarks_list), len(bat_angles), len(ball_positions)
                )
                # Use frame-based quality if it's better or if coordinator didn't provide one
                if not tracking_quality or frame_based_quality.get('overallScore', 0) > tracking_quality.get('overallScore', 0):
                    tracking_quality = frame_based_quality
            
            # Convert numpy types to native Python types for JSON serialization
            def convert_to_native(obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                elif isinstance(obj, np.bool_):
                    return bool(obj)
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                elif hasattr(obj, '__dict__'):
                    # Handle objects with attributes (like LandmarkWrapper)
                    try:
                        if hasattr(obj, 'x') and hasattr(obj, 'y'):
                            # MediaPipe landmark
                            return {
                                'x': float(obj.x),
                                'y': float(obj.y),
                                'z': float(obj.z) if hasattr(obj, 'z') else 0.0,
                                'visibility': float(obj.visibility) if hasattr(obj, 'visibility') else 1.0
                            }
                        return str(obj)
                    except:
                        return str(obj)
                elif isinstance(obj, dict):
                    return {k: convert_to_native(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_to_native(item) for item in obj]
                return obj
            
            return convert_to_native({
                'ok': True,
                'videoInfo': {
                    'fps': float(fps),
                    'frameCount': frame_count,
                    'duration': float(duration),
                    'width': width,
                    'height': height
                },
                'contactFrame': contact_frame,
                'contact': contact_result,
                'metrics': metrics,
                'formAnalysis': form_analysis,
                'swingPhases': swing_phases,
                'biomechanics': biomechanics,
                'formErrors': form_errors,
                'trackingTrajectories': tracking_trajectories,
                'trackingQuality': tracking_quality,
                'frames': frames_data,
                'visualization': {
                    'skeletonOverlay': True,
                    'batLine': True,
                    'contactHighlight': True
                }
            })
        
        except Exception as e:
            logger.error(f"Video analysis error: {str(e)}", exc_info=True)
            return {
                'ok': False,
                'error': str(e)
            }
    
    def _process_frame(self, 
                      frame: np.ndarray,
                      frame_idx: int,
                      fps: float,
                      frame_shape: Tuple[int, int],
                      prev_ball_position: Optional[Tuple[float, float]] = None) -> Optional[Dict]:
        """
        Process a single frame
        
        Args:
            frame: Frame as numpy array (RGB)
            frame_idx: Frame index
            fps: Frames per second
            frame_shape: (height, width) of frame
            
        Returns:
            Dictionary with frame analysis results
        """
        try:
            # 1. Person detection & cropping (simplified - use full frame for now)
            # TODO: Add YOLO person detection for better cropping
            cropped_frame = frame
            
            # 2. Pose estimation
            pose_result = self.pose_detector.detect_pose(cropped_frame)
            pose_landmarks = None
            pose_keypoints = None
            
            if pose_result.get('ok'):
                # Extract landmarks from MediaPipe result
                # PoseDetector now returns landmarks as a list of dicts
                landmarks_list = pose_result.get('landmarks', [])
                
                # Convert landmarks list to a format compatible with MediaPipe landmark structure
                # Create a simple wrapper class to mimic MediaPipe landmark structure
                class LandmarkWrapper:
                    def __init__(self, x, y, z, visibility):
                        self.x = x
                        self.y = y
                        self.z = z
                        self.visibility = visibility
                
                # Convert landmarks list to wrapper objects for compatibility
                if landmarks_list:
                    pose_landmarks = [
                        LandmarkWrapper(
                            lm['x'],
                            lm['y'],
                            lm.get('z', 0),
                            lm.get('visibility', 1.0)
                        )
                        for lm in landmarks_list
                    ]
                
                pose_keypoints = landmarks_list
            
            # 3. Person detection (for tracking coordinator)
            person_detection = None
            if self.tracking_coordinator:
                try:
                    person_detection = self.person_detector.detect_person_bbox(cropped_frame)
                    if person_detection:
                        persons = self.person_detector.detect_persons(cropped_frame)
                        if persons:
                            batter = self.person_detector.select_batter(persons, frame_shape)
                            if batter:
                                person_detection = {
                                    'bbox': batter['bbox'],
                                    'confidence': batter['confidence'],
                                    'center': batter['center']
                                }
                except Exception as e:
                    logger.debug(f"Person detection error: {e}")
            
            # 4. Bat detection
            bat_result = self.bat_detector.detect_bat(cropped_frame, pose_landmarks)
            bat_angle = None
            bat_position = None
            
            if bat_result:
                bat_angle = bat_result.get('angle')
                bbox = bat_result.get('bbox')
                if bbox:
                    # Calculate bat center position
                    bat_position = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
            
            # 5. Ball detection
            ball_result = self.ball_detector.detect_ball(cropped_frame)
            ball_data = None
            
            if ball_result:
                # Track ball across frames using Kalman Filter (handled internally)
                tracked_ball = self.ball_detector.track_ball(prev_ball_position, ball_result)
                if tracked_ball:
                    ball_data = {
                        'center': tracked_ball.get('center'),
                        'radius': tracked_ball.get('radius'),
                        'confidence': tracked_ball.get('confidence'),
                        'bbox': tracked_ball.get('bbox'),
                        'velocity': tracked_ball.get('velocity', 0.0),
                        'velocity_vector': tracked_ball.get('velocity_vector'),
                        'tracked': tracked_ball.get('tracked', False),
                        'method': tracked_ball.get('method', 'unknown'),
                        'track_id': tracked_ball.get('track_id')
                    }
                else:
                    ball_data = {
                        'center': ball_result.get('center'),
                        'radius': ball_result.get('radius'),
                        'confidence': ball_result.get('confidence'),
                        'bbox': ball_result.get('bbox'),
                        'method': ball_result.get('method', 'unknown')
                    }
            
            # 6. Update tracking coordinator if enabled
            tracking_info = None
            if self.tracking_coordinator:
                try:
                    tracking_info = self.tracking_coordinator.update_frame(
                        person_detection,
                        bat_result,
                        ball_result,
                        pose_landmarks,
                        frame_idx
                    )
                except Exception as e:
                    logger.debug(f"Tracking coordinator error: {e}")
            
            result = {
                'frameIndex': frame_idx,
                'timestamp': frame_idx / fps if fps > 0 else 0,
                'pose': pose_keypoints,
                'pose_landmarks': pose_landmarks,
                'batAngle': bat_angle,
                'batPosition': bat_position,
                'bat': bat_result,
                'ball': ball_data
            }
            
            # Add tracking info if available
            if tracking_info:
                result['tracking'] = tracking_info
                # Update bat and ball with tracked versions if available
                if tracking_info.get('bat'):
                    result['bat'] = tracking_info['bat']
                    if tracking_info['bat'].get('angle'):
                        result['batAngle'] = tracking_info['bat']['angle']
                if tracking_info.get('ball'):
                    result['ball'] = tracking_info['ball']
            
            return result
        
        except Exception as e:
            logger.error(f"Frame processing error: {str(e)}", exc_info=True)
            return None
    
    def _calculate_aggregated_metrics(self,
                                     bat_angles: List[Optional[float]],
                                     ball_positions: List[Optional[Dict]],
                                     contact_frame: Optional[int],
                                     fps: float,
                                     pose_landmarks_list: List[Optional[List]],
                                     frame_shape: Tuple[int, int]) -> Dict:
        """Calculate aggregated metrics across all frames"""
        # Validate inputs
        if not bat_angles or not fps or fps <= 0:
            return {
                'batAngularVelocity': None,
                'batLinearSpeed': None,
                'batLinearSpeedMph': None,
                'exitVelocityEstimate': None,
                'exitVelocityEstimateMph': None,
                'exitVelocityErrorMargin': None,
                'launchAngle': None,
                'hasValidData': False
            }
        
        # Filter out None values and find valid bat angles
        valid_bat_angles = [a for a in bat_angles if a is not None]
        if not valid_bat_angles:
            return {
                'batAngularVelocity': None,
                'batLinearSpeed': None,
                'batLinearSpeedMph': None,
                'exitVelocityEstimate': None,
                'exitVelocityEstimateMph': None,
                'exitVelocityErrorMargin': None,
                'launchAngle': None,
                'hasValidData': False
            }
        
        # If no contact frame or invalid, try to find peak velocity frame
        if contact_frame is None or contact_frame >= len(bat_angles) or bat_angles[contact_frame] is None:
            # Find frame with maximum bat angle change (likely contact/swing)
            max_velocity = 0.0
            best_frame = None
            dt = 1.0 / fps
            
            for i in range(1, len(bat_angles)):
                if bat_angles[i] is not None and bat_angles[i-1] is not None:
                    angle_diff = abs(bat_angles[i] - bat_angles[i-1])
                    # Normalize angle difference
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff
                    velocity = angle_diff / dt
                    if velocity > max_velocity:
                        max_velocity = velocity
                        best_frame = i
            
            if best_frame is None:
                return {
                    'batAngularVelocity': None,
                    'batLinearSpeed': None,
                    'batLinearSpeedMph': None,
                    'exitVelocityEstimate': None,
                    'exitVelocityEstimateMph': None,
                    'exitVelocityErrorMargin': None,
                    'launchAngle': None,
                    'hasValidData': False
                }
            contact_frame = best_frame
        
        # Validate contact frame has valid bat angle
        if bat_angles[contact_frame] is None:
            return {
                'batAngularVelocity': None,
                'batLinearSpeed': None,
                'batLinearSpeedMph': None,
                'exitVelocityEstimate': None,
                'exitVelocityEstimateMph': None,
                'exitVelocityErrorMargin': None,
                'launchAngle': None,
                'hasValidData': False
            }
        
        # Calculate bat speed at contact (use list with None values, function handles it)
        bat_speed_result = self.metrics_calculator.calculate_bat_speed(
            bat_angles,
            contact_frame,
            fps
        )
        
        # Validate results are not NaN or invalid
        angular_velocity = bat_speed_result.get('angular_velocity', 0.0)
        linear_speed = bat_speed_result.get('linear_speed', 0.0)
        linear_speed_mph = bat_speed_result.get('linear_speed_mph', 0.0)
        
        # Check for NaN or invalid values (handle both numpy and Python types)
        try:
            if angular_velocity is not None and (not isinstance(angular_velocity, (int, float)) or 
                                                 np.isnan(angular_velocity) or np.isinf(angular_velocity) or angular_velocity < 0):
                angular_velocity = None
        except (TypeError, ValueError):
            angular_velocity = None
            
        try:
            if linear_speed is not None and (not isinstance(linear_speed, (int, float)) or 
                                             np.isnan(linear_speed) or np.isinf(linear_speed) or linear_speed < 0):
                linear_speed = None
                linear_speed_mph = None
        except (TypeError, ValueError):
            linear_speed = None
            linear_speed_mph = None
            
        try:
            if linear_speed_mph is not None and (not isinstance(linear_speed_mph, (int, float)) or 
                                                  np.isnan(linear_speed_mph) or np.isinf(linear_speed_mph) or linear_speed_mph < 0):
                linear_speed_mph = None
        except (TypeError, ValueError):
            linear_speed_mph = None
        
        # Estimate exit velocity only if we have valid bat speed
        exit_velocity_result = None
        if linear_speed is not None and linear_speed > 0:
            bat_angle_at_contact = bat_angles[contact_frame]
            exit_velocity_result = self.metrics_calculator.estimate_exit_velocity(
                linear_speed,
                bat_angle_at_contact or 0.0
            )
            
            # Validate exit velocity
            exit_vel = exit_velocity_result.get('exit_velocity', 0.0)
            exit_vel_mph = exit_velocity_result.get('exit_velocity_mph', 0.0)
            try:
                if exit_vel is not None and (not isinstance(exit_vel, (int, float)) or 
                                              np.isnan(exit_vel) or np.isinf(exit_vel) or exit_vel < 0):
                    exit_velocity_result = None
            except (TypeError, ValueError):
                exit_velocity_result = None
        
        # Calculate launch angle (from bat angle at contact)
        bat_angle_at_contact = bat_angles[contact_frame]
        launch_angle = None
        if bat_angle_at_contact is not None:
            try:
                launch_angle = float(bat_angle_at_contact)
                if not isinstance(launch_angle, (int, float)) or np.isnan(launch_angle) or np.isinf(launch_angle):
                    launch_angle = None
            except (TypeError, ValueError):
                launch_angle = None
        
        # Safely convert to float, handling None values
        def safe_float(value):
            if value is None:
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None
        
        return {
            'batAngularVelocity': safe_float(angular_velocity),
            'batLinearSpeed': safe_float(linear_speed),
            'batLinearSpeedMph': safe_float(linear_speed_mph),
            'exitVelocityEstimate': safe_float(exit_velocity_result.get('exit_velocity', 0.0)) if exit_velocity_result else None,
            'exitVelocityEstimateMph': safe_float(exit_velocity_result.get('exit_velocity_mph', 0.0)) if exit_velocity_result else None,
            'exitVelocityErrorMargin': safe_float(exit_velocity_result.get('error_margin', 0.0)) if exit_velocity_result else None,
            'launchAngle': launch_angle,
            'hasValidData': angular_velocity is not None and linear_speed is not None
        }
    
    def _calculate_tracking_quality_from_frames(self,
                                               frames_data: List[Dict],
                                               total_pose_frames: int,
                                               total_bat_frames: int,
                                               total_ball_frames: int) -> Dict:
        """
        Calculate tracking quality from actual frame detection results
        
        Args:
            frames_data: List of frame analysis results
            total_pose_frames: Total frames with pose detected
            total_bat_frames: Total frames with bat detected
            total_ball_frames: Total frames with ball detected
            
        Returns:
            Dictionary with tracking quality metrics
        """
        if not frames_data:
            return {
                'overallScore': 0.0,
                'personTrackingRatio': 0.0,
                'batTrackingRatio': 0.0,
                'ballTrackingRatio': 0.0,
                'issues': ['No frames processed']
            }
        
        total_frames = len(frames_data)
        
        # Count detections from frames
        person_detected = sum(1 for f in frames_data if f.get('pose_landmarks') is not None)
        bat_detected = sum(1 for f in frames_data if f.get('bat_angle') is not None or f.get('bat_position') is not None)
        ball_detected = sum(1 for f in frames_data if f.get('ball') is not None and f.get('ball', {}).get('center') is not None)
        
        # Calculate ratios
        person_ratio = person_detected / total_frames if total_frames > 0 else 0.0
        bat_ratio = bat_detected / total_frames if total_frames > 0 else 0.0
        ball_ratio = ball_detected / total_frames if total_frames > 0 else 0.0
        
        # Overall score (weighted: person is most important, bat is critical, ball is nice to have)
        overall_score = (person_ratio * 0.5 + bat_ratio * 0.4 + ball_ratio * 0.1)
        
        # Identify issues (in English for consistency)
        issues = []
        if person_ratio < 0.5:
            issues.append(f"Person detected in only {person_ratio*100:.1f}% of frames")
        if bat_ratio < 0.3:
            issues.append(f"Bat detected in only {bat_ratio*100:.1f}% of frames - this affects metrics")
        if ball_ratio < 0.1:
            issues.append(f"Ball detected in only {ball_ratio*100:.1f}% of frames (normal for fast-moving videos)")
        
        return {
            'overallScore': float(overall_score),
            'personTrackingRatio': float(person_ratio),
            'batTrackingRatio': float(bat_ratio),
            'ballTrackingRatio': float(ball_ratio),
            'issues': issues,
            'totalFrames': total_frames,
            'personDetected': person_detected,
            'batDetected': bat_detected,
            'ballDetected': ball_detected
        }

