"""
Storage Server - Flask API for video and image storage
Can run on a separate computer as a dedicated storage server
"""
import os
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import logging

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    try:
        load_dotenv(env_local)
        logging.info(f"Loaded environment from {env_local}")
    except Exception as e:
        logging.warning(f"Failed to load .env.local: {e}")
        logging.info("Falling back to default .env loading")
        load_dotenv()
else:
    # Fallback to local .env file
    load_dotenv()
    logging.info("Loaded environment from local .env file")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Import routes and middleware
from middleware import auth
from routes import storage, health
from swagger import swagger_bp

# Register blueprints
app.register_blueprint(health.bp)
app.register_blueprint(storage.bp)
app.register_blueprint(swagger_bp)  # Swagger documentation

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path}")

if __name__ == '__main__':
    port = int(os.getenv('STORAGE_SERVER_PORT', '5003'))
    host = os.getenv('STORAGE_SERVER_HOST', '0.0.0.0')  # Allow external connections
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Storage Server on {host}:{port}")
    logger.info(f"Upload directory: {os.getenv('STORAGE_UPLOAD_DIR', 'uploads')}")
    
    app.run(host=host, port=port, debug=debug)

