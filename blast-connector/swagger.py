"""
Swagger/OpenAPI documentation for Blast Connector service
"""
from flask_restx import Api, Resource, fields, Namespace
from flask import Blueprint

# Create API blueprint
swagger_bp = Blueprint('swagger', __name__)

# Initialize API
api = Api(
    swagger_bp,
    version='1.0',
    title='Blast Connector API',
    description='API for connecting to Blast Motion sensors and managing sensor data',
    doc='/swagger/',  # Swagger UI endpoint
    prefix='/api'
)

# Define namespaces
blast_ns = Namespace('blast', description='Blast Motion sensor operations')
sync_ns = Namespace('sync', description='Sync operations with main project')
api.add_namespace(blast_ns, path='/blast')
api.add_namespace(sync_ns, path='/blast/sync')

# Request/Response models (must be defined before routes)
error_response = api.model('ErrorResponse', {
    'success': fields.Boolean(description='Operation success'),
    'error': fields.String(description='Error message'),
    'message': fields.String(description='Detailed error message')
})

connect_request = api.model('ConnectRequest', {
    'deviceId': fields.String(required=True, description='Blast Motion device ID'),
    'apiKey': fields.String(required=True, description='Blast Motion API key')
})

connect_response = api.model('ConnectResponse', {
    'success': fields.Boolean(description='Operation success'),
    'connection': fields.Raw(description='Connection details')
})

blast_data_request = api.model('BlastDataRequest', {
    'sessionId': fields.String(required=True, description='Session ID'),
    'data': fields.Raw(required=True, description='Blast sensor data')
})

blast_data_response = api.model('BlastDataResponse', {
    'success': fields.Boolean(description='Operation success'),
    'saved': fields.Raw(description='Saved data details')
})

session_response = api.model('SessionResponse', {
    'success': fields.Boolean(description='Operation success'),
    'session': fields.Raw(description='Session data'),
    'sessions': fields.List(fields.Raw, description='List of sessions'),
    'count': fields.Integer(description='Number of sessions')
})

sync_session_request = api.model('SyncSessionRequest', {
    'blastSessionId': fields.String(required=True, description='Blast session ID'),
    'mainSessionId': fields.String(required=True, description='Main project session ID')
})

sync_metrics_request = api.model('SyncMetricsRequest', {
    'sessionId': fields.String(required=True, description='Session ID'),
    'poseMetrics': fields.Raw(description='Pose detection metrics'),
    'blastMetrics': fields.Raw(description='Blast sensor metrics')
})

sync_compare_request = api.model('SyncCompareRequest', {
    'sessionId': fields.String(required=True, description='Session ID')
})

sync_response = api.model('SyncResponse', {
    'success': fields.Boolean(description='Operation success'),
    'sync': fields.Raw(description='Sync result'),
    'combined': fields.Raw(description='Combined metrics'),
    'comparison': fields.Raw(description='Comparison result')
})

# Document routes
@blast_ns.route('/connect')
@blast_ns.doc('connect_blast')
class ConnectBlast(Resource):
    @blast_ns.expect(connect_request)
    @blast_ns.marshal_with(connect_response, code=200)
    @blast_ns.response(400, 'Bad Request', error_response)
    @blast_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Connect to Blast Motion sensor"""
        pass

@blast_ns.route('/data')
@blast_ns.doc('receive_blast_data')
class ReceiveBlastData(Resource):
    @blast_ns.expect(blast_data_request)
    @blast_ns.marshal_with(blast_data_response, code=200)
    @blast_ns.response(400, 'Bad Request', error_response)
    @blast_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Receive data from Blast Motion sensor"""
        pass

@blast_ns.route('/sessions')
@blast_ns.doc('get_sessions')
class GetSessions(Resource):
    @blast_ns.param('limit', 'Number of sessions to return', type='integer', default=10)
    @blast_ns.param('offset', 'Number of sessions to skip', type='integer', default=0)
    @blast_ns.marshal_with(session_response, code=200)
    @blast_ns.response(500, 'Internal Server Error', error_response)
    def get(self):
        """Get all Blast sessions for the authenticated user"""
        pass

@blast_ns.route('/sessions/<session_id>')
@blast_ns.doc('get_session')
class GetSession(Resource):
    @blast_ns.param('session_id', 'Session ID', required=True)
    @blast_ns.marshal_with(session_response, code=200)
    @blast_ns.response(404, 'Session Not Found', error_response)
    @blast_ns.response(500, 'Internal Server Error', error_response)
    def get(self, session_id):
        """Get a specific Blast session with all data"""
        pass

    @blast_ns.param('session_id', 'Session ID', required=True)
    @blast_ns.response(200, 'Session deleted successfully')
    @blast_ns.response(404, 'Session Not Found', error_response)
    @blast_ns.response(500, 'Internal Server Error', error_response)
    def delete(self, session_id):
        """Delete a Blast session"""
        pass

@sync_ns.route('/session')
@sync_ns.doc('sync_session')
class SyncSession(Resource):
    @sync_ns.expect(sync_session_request)
    @sync_ns.marshal_with(sync_response, code=200)
    @sync_ns.response(400, 'Bad Request', error_response)
    @sync_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Sync Blast session data with main project session"""
        pass

@sync_ns.route('/metrics')
@sync_ns.doc('sync_metrics')
class SyncMetrics(Resource):
    @sync_ns.expect(sync_metrics_request)
    @sync_ns.marshal_with(sync_response, code=200)
    @sync_ns.response(400, 'Bad Request', error_response)
    @sync_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Sync Blast metrics with pose detection results"""
        pass

@sync_ns.route('/compare')
@sync_ns.doc('compare_data')
class CompareData(Resource):
    @sync_ns.expect(sync_compare_request)
    @sync_ns.marshal_with(sync_response, code=200)
    @sync_ns.response(400, 'Bad Request', error_response)
    @sync_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Compare Blast data with pose detection results"""
        pass
