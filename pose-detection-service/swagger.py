"""
Swagger/OpenAPI documentation for Pose Detection service
"""
from flask_restx import Api, Resource, fields, Namespace
from flask import Blueprint

# Create API blueprint
swagger_bp = Blueprint('swagger', __name__)

# Initialize API
api = Api(
    swagger_bp,
    version='1.0',
    title='Pose Detection API',
    description='API for detecting baseball swing poses and calculating swing metrics',
    doc='/swagger/',  # Swagger UI endpoint
    prefix='/api'
)

# Define namespaces
pose_ns = Namespace('pose', description='Pose detection operations')
api.add_namespace(pose_ns, path='/pose')

# Request/Response models (must be defined before routes)
error_response = api.model('ErrorResponse', {
    'error': fields.String(description='Error message'),
    'ok': fields.Boolean(description='Operation success'),
    'message': fields.String(description='Detailed error message')
})

pose_result = api.model('PoseResult', {
    'ok': fields.Boolean(description='Detection success'),
    'launchAngleEst': fields.Float(description='Estimated launch angle'),
    'attackAngleEst': fields.Float(description='Estimated attack angle'),
    'confidence': fields.Float(description='Detection confidence'),
    'keypoints': fields.List(fields.Raw, description='Detected keypoints'),
    'baseballMetrics': fields.Raw(description='Baseball-specific metrics')
})

pose_response = api.model('PoseResponse', {
    'ok': fields.Boolean(description='Detection success'),
    'launchAngleEst': fields.Float(description='Estimated launch angle'),
    'attackAngleEst': fields.Float(description='Estimated attack angle'),
    'confidence': fields.Float(description='Detection confidence'),
    'keypoints': fields.List(fields.Raw, description='Detected keypoints'),
    'baseballMetrics': fields.Raw(description='Baseball-specific metrics'),
    'error': fields.String(description='Error message if detection failed')
})

# Document routes
@pose_ns.route('/detect')
@pose_ns.doc('detect_pose')
class DetectPose(Resource):
    @pose_ns.param('image', 'Image file', type='file', required=True, location='files')
    @pose_ns.marshal_with(pose_response, code=200)
    @pose_ns.response(400, 'Bad Request', error_response)
    @pose_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """
        Detect pose from uploaded image
        
        Returns swing angles and baseball-specific metrics including:
        - Launch angle estimate
        - Attack angle estimate
        - Detection confidence
        - Keypoints
        - Baseball-specific metrics (bat path angle, hip rotation, etc.)
        """
        pass
