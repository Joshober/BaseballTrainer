"""
Baseball Swing Analysis - Python Backend
Flask API server for pose detection and image classification
"""
import os
from pathlib import Path
from flask import Flask, request, jsonify
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

# Import routes
from routes import pose, storage, health

# Register blueprints
app.register_blueprint(health.bp)
app.register_blueprint(pose.bp)
app.register_blueprint(storage.bp)

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path}")

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_BACKEND_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    logger.info(f"Starting Python backend on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)

