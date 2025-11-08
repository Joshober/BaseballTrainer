"""
Person detection service for baseball swing analysis
Detects and selects the most relevant person (batter) using YOLOv8
"""
import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple, List

logger = logging.getLogger(__name__)

class PersonDetector:
    """Detects persons in video frames and selects the most relevant one (batter)"""
    
    def __init__(self, use_yolo: bool = True, yolo_confidence: float = 0.5):
        """
        Initialize person detector
        
        Args:
            use_yolo: Whether to use YOLOv8 for person detection
            yolo_confidence: Confidence threshold for YOLO detection
        """
        self.use_yolo = use_yolo
        self.yolo_confidence = yolo_confidence
        self.yolo_model = None
        
        if use_yolo:
            try:
                from ultralytics import YOLO
                try:
                    self.yolo_model = YOLO('yolov8n.pt')
                    logger.info("YOLOv8 model loaded for person detection")
                except Exception as e:
                    logger.warning(f"Could not load YOLOv8 model: {e}. Person detection will be limited.")
                    self.use_yolo = False
            except ImportError:
                logger.warning("ultralytics not available. Person detection will be limited.")
                self.use_yolo = False
    
    def detect_persons(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect all persons in frame
        
        Args:
            frame: Input frame as numpy array (RGB or BGR)
            
        Returns:
            List of dictionaries with person detection results
        """
        if not self.yolo_model:
            return []
        
        try:
            # Run YOLO detection
            results = self.yolo_model(frame, conf=self.yolo_confidence, verbose=False)
            
            persons = []
            h, w = frame.shape[:2]
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls = int(box.cls[0].cpu().numpy())
                        # COCO class 0 is "person"
                        if cls == 0:
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            confidence = float(box.conf[0].cpu().numpy())
                            
                            if confidence >= self.yolo_confidence:
                                # Calculate person properties
                                width = x2 - x1
                                height = y2 - y1
                                area = width * height
                                center_x = (x1 + x2) / 2
                                center_y = (y1 + y2) / 2
                                
                                # Calculate distance from center (for relevance scoring)
                                frame_center_x = w / 2
                                frame_center_y = h / 2
                                distance_from_center = np.sqrt(
                                    (center_x - frame_center_x)**2 + 
                                    (center_y - frame_center_y)**2
                                )
                                
                                persons.append({
                                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                                    'center': [float(center_x), float(center_y)],
                                    'width': float(width),
                                    'height': float(height),
                                    'area': float(area),
                                    'confidence': confidence,
                                    'distance_from_center': float(distance_from_center),
                                    'aspect_ratio': float(width / height) if height > 0 else 0
                                })
            
            return persons
        
        except Exception as e:
            logger.error(f"Person detection error: {e}")
            return []
    
    def select_batter(self, persons: List[Dict], frame_shape: Tuple[int, int]) -> Optional[Dict]:
        """
        Select the most relevant person (batter) from detected persons
        
        Args:
            persons: List of person detections
            frame_shape: (height, width) of frame
            
        Returns:
            Dictionary with selected batter detection or None
        """
        if not persons:
            return None
        
        if len(persons) == 1:
            return persons[0]
        
        # Score each person based on relevance criteria
        # Batter is typically: larger, more centered, good aspect ratio (standing person)
        h, w = frame_shape[:2]
        frame_area = h * w
        
        scored_persons = []
        for person in persons:
            score = 0.0
            
            # Size factor (larger is better, but not too large)
            area_ratio = person['area'] / frame_area
            if 0.05 <= area_ratio <= 0.5:  # Reasonable size range
                score += area_ratio * 2.0
            elif area_ratio > 0.5:
                score += 0.5  # Too large, might be foreground object
            
            # Center position factor (more centered is better)
            max_distance = np.sqrt((w/2)**2 + (h/2)**2)
            center_score = 1.0 - (person['distance_from_center'] / max_distance)
            score += center_score * 1.5
            
            # Aspect ratio factor (standing person has height > width)
            aspect_ratio = person['aspect_ratio']
            if 0.3 <= aspect_ratio <= 0.7:  # Typical standing person ratio
                score += 1.0
            elif 0.7 < aspect_ratio <= 1.0:
                score += 0.5  # Might be crouching or side view
            
            # Confidence factor
            score += person['confidence'] * 1.0
            
            scored_persons.append((score, person))
        
        # Select person with highest score
        scored_persons.sort(key=lambda x: x[0], reverse=True)
        best_person = scored_persons[0][1]
        best_person['relevance_score'] = scored_persons[0][0]
        
        return best_person
    
    def detect_person_bbox(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect person and return bounding box for cropping
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Tuple (x1, y1, x2, y2) of person bounding box or None
        """
        persons = self.detect_persons(frame)
        if not persons:
            return None
        
        batter = self.select_batter(persons, frame.shape[:2])
        if not batter:
            return None
        
        bbox = batter['bbox']
        return (int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3]))
    
    def crop_person_region(self, frame: np.ndarray, bbox: Optional[Tuple[int, int, int, int]] = None, 
                          margin: float = 0.1) -> Tuple[np.ndarray, Optional[Tuple[int, int, int, int]]]:
        """
        Crop frame to person region with margin
        
        Args:
            frame: Input frame as numpy array
            bbox: Optional bounding box (x1, y1, x2, y2). If None, detects person first.
            margin: Margin as fraction of bbox size (default 0.1 = 10%)
            
        Returns:
            Tuple of (cropped_frame, original_bbox_with_margin)
        """
        if bbox is None:
            bbox = self.detect_person_bbox(frame)
            if bbox is None:
                return frame, None
        
        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        
        # Add margin
        width = x2 - x1
        height = y2 - y1
        margin_x = int(width * margin)
        margin_y = int(height * margin)
        
        x1_crop = max(0, x1 - margin_x)
        y1_crop = max(0, y1 - margin_y)
        x2_crop = min(w, x2 + margin_x)
        y2_crop = min(h, y2 + margin_y)
        
        cropped = frame[y1_crop:y2_crop, x1_crop:x2_crop]
        
        return cropped, (x1_crop, y1_crop, x2_crop, y2_crop)

