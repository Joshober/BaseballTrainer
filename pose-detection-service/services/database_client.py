"""
Database client for accessing MongoDB
Handles session lookups and other database operations
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, Any
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)
else:
    load_dotenv()

logger = logging.getLogger(__name__)

class DatabaseClient:
    """Client for accessing MongoDB database"""
    
    def __init__(self):
        """Initialize database connection"""
        self.mongodb_uri = os.getenv('MONGODB_URI')
        if not self.mongodb_uri:
            logger.warning("MONGODB_URI not set - database operations will fail")
            self.client = None
            return
        
        try:
            self.client = MongoClient(self.mongodb_uri)
            # Test connection
            self.client.admin.command('ping')
            logger.info("Connected to MongoDB")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            self.client = None
        except Exception as e:
            logger.error(f"Error initializing MongoDB client: {str(e)}")
            self.client = None
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session by ID from MongoDB
        
        Args:
            session_id: Session ID to look up
            
        Returns:
            Session document or None if not found
        """
        if not self.client:
            logger.error("MongoDB client not initialized")
            return None
        
        try:
            # Extract database name from URI or use default
            db_name = 'baseballhackathon'
            uri = self.mongodb_uri
            
            # Try to extract database name from URI
            # Format: mongodb+srv://user:pass@host/dbname?options
            import re
            db_match = re.search(r'mongodb\+srv?://[^/]+/([^?]+)', uri)
            if db_match and db_match.group(1) and db_match.group(1) != '':
                db_name = db_match.group(1)
            
            db = self.client[db_name]
            collection = db['sessions']
            
            # Sessions use 'id' field, not '_id'
            session = collection.find_one({'id': session_id})
            
            if session:
                logger.info(f"Found session {session_id} in MongoDB")
                # Convert ObjectId to string if present
                if '_id' in session:
                    session['_id'] = str(session['_id'])
                return session
            else:
                logger.warning(f"Session {session_id} not found in MongoDB")
                return None
            
        except OperationFailure as e:
            logger.error(f"MongoDB operation failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}", exc_info=True)
            return None
    
    def close(self):
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

