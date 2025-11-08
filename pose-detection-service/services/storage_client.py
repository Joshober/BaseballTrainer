"""
Storage server client for fetching videos
Supports both local and ngrok URLs
"""
import os
import requests
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)
else:
    load_dotenv()

logger = logging.getLogger(__name__)

class StorageClient:
    """Client for fetching files from storage server"""
    
    def __init__(self):
        """Initialize storage client with URL from environment"""
        # Check for ngrok URL first (for remote storage server)
        self.base_url = os.getenv('NGROK_STORAGE_SERVER_URL')
        if not self.base_url:
            # Fallback to local storage server URL
            self.base_url = os.getenv('STORAGE_SERVER_URL', 'http://localhost:5003')
        
        # Remove trailing slash if present
        self.base_url = self.base_url.rstrip('/')
        logger.info(f"Storage client initialized with base URL: {self.base_url}")
    
    def fetch_video(self, user_id: str, video_id: str) -> Optional[bytes]:
        """
        Fetch video from storage server
        
        Args:
            user_id: User ID (from authenticated session)
            video_id: Video ID (filename)
            
        Returns:
            Video bytes if successful, None if error
        """
        try:
            # Construct path: {user_id}/{video_id}
            path = f"{user_id}/{video_id}"
            url = f"{self.base_url}/api/storage/{path}"
            
            logger.info(f"Fetching video from: {url}")
            
            # Make GET request (no auth needed, GET endpoint is public)
            response = requests.get(url, timeout=30)
            
            if response.status_code == 404:
                logger.error(f"Video not found: {path}")
                return None
            
            response.raise_for_status()
            
            # Return video bytes
            return response.content
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching video from storage server: {str(e)}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching video: {str(e)}", exc_info=True)
            return None

