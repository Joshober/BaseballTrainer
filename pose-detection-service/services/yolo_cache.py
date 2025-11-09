"""
YOLO model cache to avoid reloading models on every request
"""
import logging
from typing import Optional
from ultralytics import YOLO

logger = logging.getLogger(__name__)

# Global cache for YOLO models
_yolo_model_cache: Optional[YOLO] = None

def get_yolo_model() -> Optional[YOLO]:
    """
    Get cached YOLO model or load it if not cached
    
    Returns:
        YOLO model instance or None if loading fails
    """
    global _yolo_model_cache
    
    if _yolo_model_cache is None:
        try:
            logger.info("Loading YOLOv8 model (first time, will be cached)...")
            _yolo_model_cache = YOLO('yolov8n.pt')
            logger.info("YOLOv8 model loaded and cached successfully")
        except Exception as e:
            logger.error(f"Could not load YOLOv8 model: {e}")
            return None
    
    return _yolo_model_cache

def clear_yolo_cache():
    """Clear the YOLO model cache (useful for testing or memory management)"""
    global _yolo_model_cache
    _yolo_model_cache = None
    logger.info("YOLO model cache cleared")

