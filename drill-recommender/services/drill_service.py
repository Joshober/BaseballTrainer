"""
Drill service for managing and searching drills
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from typing import List, Dict, Optional, Any
import logging
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)

logger = logging.getLogger(__name__)

class DrillService:
    """Service for managing baseball drills"""
    
    def __init__(self):
        """Initialize MongoDB connection"""
        mongodb_uri = os.getenv('MONGODB_URI', '')
        if not mongodb_uri:
            raise ValueError('MONGODB_URI environment variable is required. Make sure .env.local exists in the project root.')
        
        # Remove quotes if present
        mongodb_uri = mongodb_uri.strip('"\'')
        
        # Extract database name from URI or use default
        database_name = os.getenv('MONGODB_DATABASE', 'baseball')
        
        # Parse URI to extract database name if present
        try:
            from urllib.parse import urlparse
            parsed = urlparse(mongodb_uri)
            if parsed.path and parsed.path != '/':
                # Extract database name from path (remove leading /)
                db_from_uri = parsed.path.lstrip('/').split('/')[0]
                if db_from_uri:
                    database_name = db_from_uri
        except Exception:
            pass  # Use default database name
        
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database(database_name)
        self.drills_collection = self.db.drills
        
        # Create indexes
        self._create_indexes()
        
        logger.info("DrillService initialized")
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            self.drills_collection.create_index([('category', ASCENDING)])
            self.drills_collection.create_index([('difficulty', ASCENDING)])
            self.drills_collection.create_index([('corrections', ASCENDING)])
            self.drills_collection.create_index([('name', 'text'), ('description', 'text')])
            logger.info("Database indexes created")
        except Exception as e:
            logger.warning(f"Error creating indexes: {str(e)}")
    
    def get_drills(
        self,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        equipment: Optional[str] = None
    ) -> List[Dict]:
        """Get drills with optional filters"""
        query = {}
        
        if category:
            query['category'] = category
        if difficulty:
            query['difficulty'] = difficulty
        if equipment:
            query['equipment'] = {'$in': [equipment]}
        
        drills = list(self.drills_collection.find(query).sort('name', ASCENDING))
        
        # Convert ObjectId to string
        for drill in drills:
            drill['_id'] = str(drill['_id'])
        
        return drills
    
    def get_drill_by_id(self, drill_id: str) -> Optional[Dict]:
        """Get a drill by ID"""
        try:
            drill = self.drills_collection.find_one({'_id': ObjectId(drill_id)})
            if drill:
                drill['_id'] = str(drill['_id'])
            return drill
        except Exception:
            return None
    
    def create_drill(self, data: Dict) -> Dict:
        """Create a new drill"""
        drill = {
            'name': data['name'],
            'description': data['description'],
            'category': data['category'],
            'difficulty': data.get('difficulty', 'intermediate'),
            'equipment': data.get('equipment', []),
            'corrections': data['corrections'],
            'instructions': data.get('instructions', []),
            'videoUrl': data.get('videoUrl', ''),
            'imageUrl': data.get('imageUrl', ''),
            'duration': data.get('duration', 10),  # minutes
            'reps': data.get('reps', 10),
            'tags': data.get('tags', []),
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        result = self.drills_collection.insert_one(drill)
        drill['_id'] = str(result.inserted_id)
        
        return drill
    
    def update_drill(self, drill_id: str, data: Dict) -> Optional[Dict]:
        """Update an existing drill"""
        try:
            update_data = {**data, 'updatedAt': datetime.utcnow()}
            result = self.drills_collection.update_one(
                {'_id': ObjectId(drill_id)},
                {'$set': update_data}
            )
            
            if result.modified_count > 0:
                return self.get_drill_by_id(drill_id)
            return None
        except Exception:
            return None
    
    def delete_drill(self, drill_id: str) -> bool:
        """Delete a drill"""
        try:
            result = self.drills_collection.delete_one({'_id': ObjectId(drill_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    def recommend_drills(
        self,
        corrections: List[str],
        metrics: Dict[str, Any],
        limit: int = 5
    ) -> List[Dict]:
        """
        Recommend drills based on corrections and metrics
        
        Args:
            corrections: List of correction types (e.g., ['low_launch_angle', 'poor_hip_rotation'])
            metrics: Dictionary of swing metrics (e.g., {'launchAngle': 15, 'hipAngle': 10})
            limit: Maximum number of recommendations
        
        Returns:
            List of recommended drills sorted by relevance
        """
        # Build query based on corrections
        query = {}
        
        if corrections:
            # Find drills that address any of the corrections
            query['corrections'] = {'$in': corrections}
        
        # Also consider metrics-based recommendations
        metric_corrections = self._analyze_metrics(metrics)
        if metric_corrections:
            if 'corrections' in query:
                # Combine corrections
                query['corrections'] = {'$in': corrections + metric_corrections}
            else:
                query['corrections'] = {'$in': metric_corrections}
        
        # Get matching drills
        drills = list(self.drills_collection.find(query).limit(limit * 2))
        
        # Score and rank drills
        scored_drills = []
        for drill in drills:
            score = self._score_drill(drill, corrections, metrics)
            drill['_id'] = str(drill['_id'])
            drill['relevanceScore'] = score
            scored_drills.append(drill)
        
        # Sort by score (highest first) and return top results
        scored_drills.sort(key=lambda x: x['relevanceScore'], reverse=True)
        return scored_drills[:limit]
    
    def _analyze_metrics(self, metrics: Dict[str, Any]) -> List[str]:
        """
        Analyze metrics and determine which corrections are needed
        
        Returns list of correction types based on metric values
        """
        corrections = []
        
        # Launch angle analysis
        launch_angle = metrics.get('launchAngle')
        if launch_angle is not None:
            if launch_angle < 10:
                corrections.append('low_launch_angle')
            elif launch_angle > 35:
                corrections.append('high_launch_angle')
        
        # Hip rotation analysis
        hip_angle = metrics.get('hipAngle')
        if hip_angle is not None:
            if abs(hip_angle) < 15:
                corrections.append('poor_hip_rotation')
        
        # Shoulder angle analysis
        shoulder_angle = metrics.get('shoulderAngle')
        if shoulder_angle is not None:
            if abs(shoulder_angle) < 20:
                corrections.append('poor_shoulder_rotation')
        
        # Hand angle analysis (bat path)
        hand_angle = metrics.get('handAngle')
        if hand_angle is not None:
            if hand_angle < 0:
                corrections.append('steep_bat_path')
            elif hand_angle > 45:
                corrections.append('flat_bat_path')
        
        # Confidence analysis
        confidence = metrics.get('confidence', 1.0)
        if confidence < 0.5:
            corrections.append('poor_pose_detection')
        
        return corrections
    
    def _score_drill(
        self,
        drill: Dict,
        corrections: List[str],
        metrics: Dict[str, Any]
    ) -> float:
        """
        Score a drill based on how well it matches the corrections
        
        Returns a relevance score (0-1)
        """
        score = 0.0
        
        # Count matching corrections
        drill_corrections = drill.get('corrections', [])
        if corrections:
            matches = len(set(corrections) & set(drill_corrections))
            score += (matches / len(corrections)) * 0.7
        
        # Consider difficulty (prefer easier drills for beginners)
        difficulty = drill.get('difficulty', 'intermediate')
        if difficulty == 'beginner':
            score += 0.1
        elif difficulty == 'intermediate':
            score += 0.05
        
        # Consider equipment availability (prefer no-equipment drills)
        equipment = drill.get('equipment', [])
        if not equipment:
            score += 0.1
        
        return min(score, 1.0)
    
    def search_drills(
        self,
        query: str = '',
        corrections: List[str] = None
    ) -> List[Dict]:
        """
        Search drills by text query and/or corrections
        
        Args:
            query: Text search query
            corrections: List of correction types
        
        Returns:
            List of matching drills
        """
        search_query = {}
        
        # Text search
        if query:
            search_query['$or'] = [
                {'name': {'$regex': query, '$options': 'i'}},
                {'description': {'$regex': query, '$options': 'i'}},
                {'tags': {'$in': [query]}}
            ]
        
        # Correction filter
        if corrections:
            if '$or' in search_query:
                # Combine with AND logic
                search_query['corrections'] = {'$in': corrections}
            else:
                search_query['corrections'] = {'$in': corrections}
        
        drills = list(self.drills_collection.find(search_query).sort('name', ASCENDING))
        
        # Convert ObjectId to string
        for drill in drills:
            drill['_id'] = str(drill['_id'])
        
        return drills

