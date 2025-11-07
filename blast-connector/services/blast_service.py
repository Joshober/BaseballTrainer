"""
Blast Connect service for managing Blast Motion sensor data
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from typing import List, Dict, Optional, Any
import logging
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import requests

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)

logger = logging.getLogger(__name__)

class BlastService:
    """Service for managing Blast Motion sensor data"""
    
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
        self.blast_sessions_collection = self.db.blast_sessions
        self.blast_data_collection = self.db.blast_data
        
        # Blast API configuration
        self.blast_api_base = os.getenv('BLAST_API_BASE_URL', 'https://api.blastmotion.com')
        self.blast_api_key = os.getenv('BLAST_API_KEY', '')
        
        # Create indexes
        self._create_indexes()
        
        logger.info("BlastService initialized")
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            self.blast_sessions_collection.create_index([('userId', ASCENDING)])
            self.blast_sessions_collection.create_index([('deviceId', ASCENDING)])
            self.blast_sessions_collection.create_index([('createdAt', DESCENDING)])
            self.blast_data_collection.create_index([('sessionId', ASCENDING)])
            self.blast_data_collection.create_index([('userId', ASCENDING)])
            logger.info("Database indexes created")
        except Exception as e:
            logger.warning(f"Error creating indexes: {str(e)}")
    
    def connect_device(self, device_id: str, api_key: str) -> Dict:
        """
        Connect to a Blast Motion device
        
        Args:
            device_id: Blast device ID
            api_key: Blast API key
        
        Returns:
            Connection status and device info
        """
        try:
            # Store API key for this device
            # In production, you'd want to encrypt this
            device_info = {
                'deviceId': device_id,
                'apiKey': api_key,
                'connectedAt': datetime.utcnow(),
                'status': 'connected'
            }
            
            # Optionally verify connection with Blast API
            if self.blast_api_key or api_key:
                # Verify device connection
                # This would make an API call to Blast to verify
                # For now, we'll just store the connection info
                pass
            
            return device_info
        except Exception as e:
            logger.error(f"Error connecting device: {str(e)}")
            raise
    
    def save_blast_data(self, session_id: str, blast_data: Dict, user_id: str) -> Dict:
        """
        Save data from Blast Motion sensor
        
        Args:
            session_id: Session ID from main project
            blast_data: Blast sensor data
            user_id: User ID
        
        Returns:
            Saved data record
        """
        try:
            # Create or update session
            session = self.blast_sessions_collection.find_one({
                'sessionId': session_id,
                'userId': user_id
            })
            
            if not session:
                session = {
                    'sessionId': session_id,
                    'userId': user_id,
                    'deviceId': blast_data.get('deviceId', ''),
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                }
                result = self.blast_sessions_collection.insert_one(session)
                session['_id'] = str(result.inserted_id)
            else:
                session['_id'] = str(session['_id'])
                self.blast_sessions_collection.update_one(
                    {'_id': ObjectId(session['_id'])},
                    {'$set': {'updatedAt': datetime.utcnow()}}
                )
            
            # Save Blast data
            data_record = {
                'sessionId': session_id,
                'userId': user_id,
                'data': blast_data,
                'metrics': self._extract_metrics(blast_data),
                'createdAt': datetime.utcnow()
            }
            
            result = self.blast_data_collection.insert_one(data_record)
            data_record['_id'] = str(result.inserted_id)
            
            return data_record
        except Exception as e:
            logger.error(f"Error saving Blast data: {str(e)}")
            raise
    
    def _extract_metrics(self, blast_data: Dict) -> Dict:
        """
        Extract key metrics from Blast data
        
        Args:
            blast_data: Raw Blast sensor data
        
        Returns:
            Extracted metrics dictionary
        """
        metrics = {}
        
        # Extract common Blast metrics
        # Adjust based on actual Blast data structure
        if 'batSpeed' in blast_data:
            metrics['batSpeed'] = blast_data['batSpeed']
        if 'attackAngle' in blast_data:
            metrics['attackAngle'] = blast_data['attackAngle']
        if 'timeToContact' in blast_data:
            metrics['timeToContact'] = blast_data['timeToContact']
        if 'power' in blast_data:
            metrics['power'] = blast_data['power']
        if 'handSpeed' in blast_data:
            metrics['handSpeed'] = blast_data['handSpeed']
        if 'onPlane' in blast_data:
            metrics['onPlane'] = blast_data['onPlane']
        if 'verticalBatAngle' in blast_data:
            metrics['verticalBatAngle'] = blast_data['verticalBatAngle']
        if 'connection' in blast_data:
            metrics['connection'] = blast_data['connection']
        
        return metrics
    
    def get_user_sessions(self, user_id: str, limit: int = 10, offset: int = 0) -> List[Dict]:
        """Get all Blast sessions for a user"""
        try:
            sessions = list(
                self.blast_sessions_collection
                .find({'userId': user_id})
                .sort('createdAt', DESCENDING)
                .skip(offset)
                .limit(limit)
            )
            
            # Convert ObjectId to string
            for session in sessions:
                session['_id'] = str(session['_id'])
                
                # Get latest data for each session
                latest_data = self.blast_data_collection.find_one(
                    {'sessionId': session['sessionId']},
                    sort=[('createdAt', DESCENDING)]
                )
                if latest_data:
                    session['latestData'] = {
                        'metrics': latest_data.get('metrics', {}),
                        'createdAt': latest_data.get('createdAt').isoformat() if latest_data.get('createdAt') else None
                    }
            
            return sessions
        except Exception as e:
            logger.error(f"Error getting user sessions: {str(e)}")
            raise
    
    def get_session(self, session_id: str, user_id: str) -> Optional[Dict]:
        """Get a specific Blast session with all data"""
        try:
            session = self.blast_sessions_collection.find_one({
                'sessionId': session_id,
                'userId': user_id
            })
            
            if not session:
                return None
            
            session['_id'] = str(session['_id'])
            
            # Get all data for this session
            data_records = list(
                self.blast_data_collection
                .find({'sessionId': session_id})
                .sort('createdAt', ASCENDING)
            )
            
            for record in data_records:
                record['_id'] = str(record['_id'])
            
            session['data'] = data_records
            
            # Aggregate metrics
            session['aggregatedMetrics'] = self._aggregate_metrics(data_records)
            
            return session
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}")
            raise
    
    def _aggregate_metrics(self, data_records: List[Dict]) -> Dict:
        """Aggregate metrics from multiple data records"""
        aggregated = {}
        
        for record in data_records:
            metrics = record.get('metrics', {})
            for key, value in metrics.items():
                if key not in aggregated:
                    aggregated[key] = []
                if value is not None:
                    aggregated[key].append(value)
        
        # Calculate averages
        for key, values in aggregated.items():
            if values:
                aggregated[key] = {
                    'avg': sum(values) / len(values),
                    'min': min(values),
                    'max': max(values),
                    'count': len(values)
                }
        
        return aggregated
    
    def delete_session(self, session_id: str, user_id: str) -> bool:
        """Delete a Blast session and all its data"""
        try:
            # Delete session
            session_result = self.blast_sessions_collection.delete_one({
                'sessionId': session_id,
                'userId': user_id
            })
            
            # Delete all data for this session
            data_result = self.blast_data_collection.delete_many({
                'sessionId': session_id
            })
            
            return session_result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting session: {str(e)}")
            raise
    
    def sync_with_main_session(
        self,
        blast_session_id: str,
        main_session_id: str,
        user_id: str
    ) -> Dict:
        """
        Sync Blast session data with main project session
        
        Args:
            blast_session_id: Blast session ID
            main_session_id: Main project session ID
            user_id: User ID
        
        Returns:
            Sync result
        """
        try:
            # Get Blast session
            blast_session = self.get_session(blast_session_id, user_id)
            if not blast_session:
                raise ValueError('Blast session not found')
            
            # Update Blast session with main session ID
            self.blast_sessions_collection.update_one(
                {'sessionId': blast_session_id, 'userId': user_id},
                {'$set': {
                    'mainSessionId': main_session_id,
                    'syncedAt': datetime.utcnow()
                }}
            )
            
            return {
                'blastSessionId': blast_session_id,
                'mainSessionId': main_session_id,
                'syncedAt': datetime.utcnow().isoformat(),
                'metrics': blast_session.get('aggregatedMetrics', {})
            }
        except Exception as e:
            logger.error(f"Error syncing session: {str(e)}")
            raise
    
    def sync_metrics(
        self,
        session_id: str,
        pose_metrics: Dict,
        blast_metrics: Dict,
        user_id: str
    ) -> Dict:
        """
        Sync Blast metrics with pose detection results
        
        Args:
            session_id: Session ID
            pose_metrics: Metrics from pose detection
            blast_metrics: Metrics from Blast sensor
            user_id: User ID
        
        Returns:
            Combined metrics
        """
        try:
            combined = {
                'sessionId': session_id,
                'userId': user_id,
                'poseMetrics': pose_metrics,
                'blastMetrics': blast_metrics,
                'combined': self._combine_metrics(pose_metrics, blast_metrics),
                'createdAt': datetime.utcnow()
            }
            
            # Save combined metrics
            self.blast_data_collection.insert_one(combined)
            
            return combined
        except Exception as e:
            logger.error(f"Error syncing metrics: {str(e)}")
            raise
    
    def _combine_metrics(self, pose_metrics: Dict, blast_metrics: Dict) -> Dict:
        """Combine pose detection and Blast metrics"""
        combined = {}
        
        # Combine launch angle (pose) with attack angle (Blast)
        if 'launchAngle' in pose_metrics and 'attackAngle' in blast_metrics:
            combined['launchAngle'] = pose_metrics['launchAngle']
            combined['attackAngle'] = blast_metrics['attackAngle']
            combined['angleDifference'] = abs(pose_metrics['launchAngle'] - blast_metrics['attackAngle'])
        
        # Combine hand angle (pose) with bat path (Blast)
        if 'handAngle' in pose_metrics and 'verticalBatAngle' in blast_metrics:
            combined['handAngle'] = pose_metrics['handAngle']
            combined['verticalBatAngle'] = blast_metrics['verticalBatAngle']
        
        # Add Blast-specific metrics
        if 'batSpeed' in blast_metrics:
            combined['batSpeed'] = blast_metrics['batSpeed']
        if 'handSpeed' in blast_metrics:
            combined['handSpeed'] = blast_metrics['handSpeed']
        if 'power' in blast_metrics:
            combined['power'] = blast_metrics['power']
        
        # Add pose-specific metrics
        if 'shoulderAngle' in pose_metrics:
            combined['shoulderAngle'] = pose_metrics['shoulderAngle']
        if 'hipAngle' in pose_metrics:
            combined['hipAngle'] = pose_metrics['hipAngle']
        
        return combined
    
    def compare_with_pose(self, session_id: str, user_id: str) -> Dict:
        """
        Compare Blast data with pose detection results
        
        Args:
            session_id: Session ID
            user_id: User ID
        
        Returns:
            Comparison results
        """
        try:
            # Get Blast session
            blast_session = self.get_session(session_id, user_id)
            if not blast_session:
                raise ValueError('Session not found')
            
            # Get main session (if synced)
            main_session_id = blast_session.get('mainSessionId')
            
            comparison = {
                'sessionId': session_id,
                'mainSessionId': main_session_id,
                'blastMetrics': blast_session.get('aggregatedMetrics', {}),
                'comparison': {}
            }
            
            # If we have pose metrics from main session, compare them
            # This would require fetching from main project database
            # For now, we'll return the Blast metrics
            
            return comparison
        except Exception as e:
            logger.error(f"Error comparing data: {str(e)}")
            raise

