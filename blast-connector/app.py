"""
Blast Connect Data Integration - Flask Server
Connects to Blast Motion sensors and integrates data into the main project
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
from routes import blast, health, sync, swings, debug
from swagger import swagger_bp

# Register blueprints
app.register_blueprint(health.bp)
app.register_blueprint(blast.bp)
app.register_blueprint(sync.bp)
app.register_blueprint(swings.bp)
try:
    app.register_blueprint(debug.bp)  # Debug page
    logger.info("Debug blueprint registered successfully")
except Exception as e:
    logger.error(f"Failed to register debug blueprint: {e}", exc_info=True)

app.register_blueprint(swagger_bp)  # Swagger documentation

# Initialize debug route with swing detection service
try:
    debug.set_swing_detection_service(swings.get_swing_detection_service())
    logger.info("Debug route initialized with swing detection service")
except Exception as e:
    logger.error(f"Failed to initialize debug route: {e}", exc_info=True)

@app.route('/test-debug')
def test_debug():
    """Test route to verify Flask is working"""
    return jsonify({'message': 'Flask is working', 'debug_routes': ['/debug', '/api/debug/swing-detection']})

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path}")

if __name__ == '__main__':
    port = int(os.getenv('BLAST_CONNECTOR_PORT', 5002))
    flask_debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    logger.info(f"Starting Blast Connector on port {port}")
    logger.info(f"Debug routes available: /debug, /api/debug/swing-detection")
    logger.info(f"Registered routes: {[rule.rule for rule in app.url_map.iter_rules() if 'debug' in rule.rule]}")
    app.run(host='0.0.0.0', port=port, debug=flask_debug, use_reloader=False)

