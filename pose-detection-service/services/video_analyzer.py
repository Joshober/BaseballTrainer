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
from services.bat_detector import BatDetector
from services.ball_detector import BallDetector
from services.contact_detector import ContactDetector
from services.metrics_calculator import MetricsCalculator

logger = logging.getLogger(__name__)

class VideoAnalyzer:
    """Analyzes baseball swing videos frame by frame"""
    
    def __init__(self, 
                 processing_mode: str = 'full',
                 sample_rate: int = 1,
                 max_frames: Optional[int] = None,
                 enable_yolo: bool = True,
                 yolo_confidence: float = 0.5,
                 batter_height_m: Optional[float] = None):
        """
        Initialize video analyzer
        
        Args:
            processing_mode: 'full', 'sampled', or 'streaming'
            sample_rate: Process every Nth frame (for sampled mode)
            max_frames: Maximum frames to process
            enable_yolo: Use YOLOv8 for bat/ball detection
            yolo_confidence: YOLO detection confidence threshold
            batter_height_m: Batter height in meters for calibration
        """
        self.processing_mode = processing_mode
        self.sample_rate = sample_rate
        self.max_frames = max_frames
        self.enable_yolo = enable_yolo
        self.yolo_confidence = yolo_confidence
        
        # Initialize services
        self.pose_detector = PoseDetector()
        self.bat_detector = BatDetector(use_yolo=enable_yolo, yolo_confidence=yolo_confidence)
        self.ball_detector = BallDetector(use_yolo=enable_yolo, yolo_confidence=yolo_confidence)
        self.contact_detector = ContactDetector()
        self.metrics_calculator = MetricsCalculator(batter_height_m=batter_height_m)
    
    def analyze_video(self, video_bytes: bytes, filename: str = 'video.mp4') -> Dict:
        """
        Analyze video file
        
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
            
            # Open video with OpenCV
            cap = cv2.VideoCapture(temp_path)
            
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
            prev_ball_position: Optional[Tuple[float, float]] = None
            
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
                
                # Process frame
                frame_result = self._process_frame(
                    frame_rgb,
                    frame_idx,
                    fps,
                    (height, width),
                    prev_ball_position
                )
                
                # Update previous ball position for next frame
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
            
            return {
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
                'frames': frames_data,
                'visualization': {
                    'skeletonOverlay': True,
                    'batLine': True,
                    'contactHighlight': True
                }
            }
        
        except Exception as e:
            logger.error(f"Video analysis error: {str(e)}", exc_info=True)
            return {
                'ok': False,
                'error': str(e)
            }
        
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"Could not delete temp file: {e}")
    
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
            
            # 3. Bat detection
            bat_result = self.bat_detector.detect_bat(cropped_frame, pose_landmarks)
            bat_angle = None
            bat_position = None
            
            if bat_result:
                bat_angle = bat_result.get('angle')
                bbox = bat_result.get('bbox')
                if bbox:
                    # Calculate bat center position
                    bat_position = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
            
                # 4. Ball detection
                ball_result = self.ball_detector.detect_ball(cropped_frame)
                ball_data = None
                
                if ball_result:
                    # Track ball across frames
                    tracked_ball = self.ball_detector.track_ball(prev_ball_position, ball_result)
                    if tracked_ball:
                        ball_data = {
                            'center': tracked_ball.get('center'),
                            'radius': tracked_ball.get('radius'),
                            'confidence': tracked_ball.get('confidence'),
                            'bbox': tracked_ball.get('bbox'),
                            'velocity': tracked_ball.get('velocity', 0.0),
                            'tracked': tracked_ball.get('tracked', False)
                        }
                    else:
                        ball_data = {
                            'center': ball_result.get('center'),
                            'radius': ball_result.get('radius'),
                            'confidence': ball_result.get('confidence'),
                            'bbox': ball_result.get('bbox')
                        }
            
            return {
                'frameIndex': frame_idx,
                'timestamp': frame_idx / fps if fps > 0 else 0,
                'pose': pose_keypoints,
                'pose_landmarks': pose_landmarks,
                'batAngle': bat_angle,
                'batPosition': bat_position,
                'bat': bat_result,
                'ball': ball_data
            }
        
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
        if not contact_frame or contact_frame >= len(bat_angles):
            return {
                'batAngularVelocity': 0.0,
                'batLinearSpeed': 0.0,
                'exitVelocityEstimate': 0.0,
                'launchAngle': 0.0
            }
        
        # Calculate bat speed at contact
        bat_speed_result = self.metrics_calculator.calculate_bat_speed(
            bat_angles,
            contact_frame,
            fps
        )
        
        # Estimate exit velocity
        bat_angle_at_contact = bat_angles[contact_frame] if contact_frame < len(bat_angles) else None
        exit_velocity_result = self.metrics_calculator.estimate_exit_velocity(
            bat_speed_result.get('linear_speed', 0.0),
            bat_angle_at_contact or 0.0
        )
        
        # Calculate launch angle (from pose or bat angle)
        launch_angle = bat_angle_at_contact or 0.0
        
        return {
            'batAngularVelocity': bat_speed_result.get('angular_velocity', 0.0),
            'batLinearSpeed': bat_speed_result.get('linear_speed', 0.0),
            'batLinearSpeedMph': bat_speed_result.get('linear_speed_mph', 0.0),
            'exitVelocityEstimate': exit_velocity_result.get('exit_velocity', 0.0),
            'exitVelocityEstimateMph': exit_velocity_result.get('exit_velocity_mph', 0.0),
            'exitVelocityErrorMargin': exit_velocity_result.get('error_margin', 0.0),
            'launchAngle': float(launch_angle)
        }

