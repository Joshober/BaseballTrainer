"""
Video frame extractor service
Extracts frames from video bytes and converts to base64 for API consumption
"""
import cv2
import numpy as np
import base64
import logging
import tempfile
import os
from typing import List, Tuple, Optional
from io import BytesIO

logger = logging.getLogger(__name__)

class VideoFrameExtractor:
    """Extracts frames from video files"""
    
    def extract_frames(self, video_bytes: bytes, sample_rate: int = 10) -> List[Tuple[int, str]]:
        """
        Extract frames from video bytes
        
        Args:
            video_bytes: Video file as bytes
            sample_rate: Extract every Nth frame (default: 10)
            
        Returns:
            List of tuples: (frame_index, base64_encoded_image)
        """
        frames = []
        temp_file = None
        
        try:
            # Save video to temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix='.mp4')
            temp_file = temp_path
            
            # Write video bytes to temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(video_bytes)
            
            # Open video with OpenCV
            cap = cv2.VideoCapture(temp_path)
            
            if not cap.isOpened():
                logger.error("Could not open video file")
                return frames
            
            frame_idx = 0
            extracted_count = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Extract every Nth frame
                if frame_idx % sample_rate == 0:
                    # Convert BGR to RGB
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', frame_rgb, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    
                    # Convert to base64
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    frames.append((frame_idx, frame_base64))
                    extracted_count += 1
                
                frame_idx += 1
            
            cap.release()
            logger.info(f"Extracted {extracted_count} frames from {frame_idx} total frames (sample_rate={sample_rate})")
            
            return frames
            
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}", exc_info=True)
            return frames
            
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"Could not delete temp file: {e}")

