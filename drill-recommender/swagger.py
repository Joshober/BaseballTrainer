"""
Swagger/OpenAPI documentation for Drill Recommender service
"""
from flask_restx import Api, Resource, fields, Namespace
from flask import Blueprint

# Create API blueprint
swagger_bp = Blueprint('swagger', __name__)

# Initialize API
api = Api(
    swagger_bp,
    version='1.0',
    title='Drill Recommender API',
    description='API for recommending baseball drills based on swing analysis',
    doc='/swagger/',  # Swagger UI endpoint
    prefix='/api'
)

# Define namespaces
drills_ns = Namespace('drills', description='Drill management operations')
search_ns = Namespace('search', description='Drill search and recommendations')
api.add_namespace(drills_ns, path='/drills')
api.add_namespace(search_ns, path='/drills')

# Request/Response models (must be defined before routes)
drill = api.model('Drill', {
    '_id': fields.String(description='Drill ID'),
    'name': fields.String(required=True, description='Drill name'),
    'description': fields.String(description='Drill description'),
    'category': fields.String(description='Drill category'),
    'difficulty': fields.String(enum=['beginner', 'intermediate', 'advanced'], description='Difficulty level'),
    'equipment': fields.List(fields.String, description='Required equipment'),
    'corrections': fields.List(fields.String, description='Swing corrections addressed'),
    'instructions': fields.List(fields.String, description='Drill instructions'),
    'duration': fields.Integer(description='Duration in minutes'),
    'reps': fields.Integer(description='Number of repetitions'),
    'tags': fields.List(fields.String, description='Drill tags')
})

drill_list_response = api.model('DrillListResponse', {
    'success': fields.Boolean(description='Operation success'),
    'drills': fields.List(fields.Nested(drill), description='List of drills'),
    'count': fields.Integer(description='Number of drills')
})

drill_response = api.model('DrillResponse', {
    'success': fields.Boolean(description='Operation success'),
    'drill': fields.Nested(drill, description='Drill data')
})

create_drill_request = api.model('CreateDrillRequest', {
    'name': fields.String(required=True, description='Drill name'),
    'description': fields.String(required=True, description='Drill description'),
    'category': fields.String(required=True, description='Drill category'),
    'corrections': fields.List(fields.String, required=True, description='Swing corrections addressed'),
    'difficulty': fields.String(enum=['beginner', 'intermediate', 'advanced'], description='Difficulty level'),
    'equipment': fields.List(fields.String, description='Required equipment'),
    'instructions': fields.List(fields.String, description='Drill instructions'),
    'duration': fields.Integer(description='Duration in minutes'),
    'reps': fields.Integer(description='Number of repetitions'),
    'tags': fields.List(fields.String, description='Drill tags')
})

recommendation_request = api.model('RecommendationRequest', {
    'corrections': fields.List(fields.String, description='Swing corrections to address'),
    'metrics': fields.Raw(description='Swing metrics (launchAngle, shoulderAngle, etc.)'),
    'limit': fields.Integer(description='Maximum number of recommendations', default=5)
})

recommendation_response = api.model('RecommendationResponse', {
    'success': fields.Boolean(description='Operation success'),
    'recommendations': fields.List(fields.Nested(drill), description='Recommended drills'),
    'count': fields.Integer(description='Number of recommendations')
})

search_request = api.model('SearchRequest', {
    'query': fields.String(description='Search query string'),
    'corrections': fields.List(fields.String, description='Filter by corrections')
})

search_response = api.model('SearchResponse', {
    'success': fields.Boolean(description='Operation success'),
    'results': fields.List(fields.Nested(drill), description='Search results'),
    'count': fields.Integer(description='Number of results')
})

error_response = api.model('ErrorResponse', {
    'success': fields.Boolean(description='Operation success'),
    'error': fields.String(description='Error message'),
    'message': fields.String(description='Detailed error message')
})

# Document routes
@drills_ns.route('')
@drills_ns.doc('get_drills')
class GetDrills(Resource):
    @drills_ns.param('category', 'Filter by category', type='string')
    @drills_ns.param('difficulty', 'Filter by difficulty', type='string', enum=['beginner', 'intermediate', 'advanced'])
    @drills_ns.param('equipment', 'Filter by equipment', type='string')
    @drills_ns.marshal_with(drill_list_response, code=200)
    @drills_ns.response(500, 'Internal Server Error', error_response)
    def get(self):
        """Get all drills or filter by category, difficulty, or equipment"""
        pass

    @drills_ns.expect(create_drill_request)
    @drills_ns.marshal_with(drill_response, code=201)
    @drills_ns.response(400, 'Bad Request', error_response)
    @drills_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Create a new drill (admin only)"""
        pass

@drills_ns.route('/<drill_id>')
@drills_ns.doc('get_drill')
class GetDrill(Resource):
    @drills_ns.param('drill_id', 'Drill ID', required=True)
    @drills_ns.marshal_with(drill_response, code=200)
    @drills_ns.response(404, 'Drill Not Found', error_response)
    @drills_ns.response(500, 'Internal Server Error', error_response)
    def get(self, drill_id):
        """Get a specific drill by ID"""
        pass

    @drills_ns.param('drill_id', 'Drill ID', required=True)
    @drills_ns.expect(create_drill_request)
    @drills_ns.marshal_with(drill_response, code=200)
    @drills_ns.response(404, 'Drill Not Found', error_response)
    @drills_ns.response(500, 'Internal Server Error', error_response)
    def put(self, drill_id):
        """Update an existing drill (admin only)"""
        pass

    @drills_ns.param('drill_id', 'Drill ID', required=True)
    @drills_ns.response(200, 'Drill deleted successfully')
    @drills_ns.response(404, 'Drill Not Found', error_response)
    @drills_ns.response(500, 'Internal Server Error', error_response)
    def delete(self, drill_id):
        """Delete a drill (admin only)"""
        pass

@search_ns.route('/recommend')
@search_ns.doc('recommend_drills')
class RecommendDrills(Resource):
    @search_ns.expect(recommendation_request)
    @search_ns.marshal_with(recommendation_response, code=200)
    @search_ns.response(400, 'Bad Request', error_response)
    @search_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Get drill recommendations based on swing analysis results"""
        pass

@search_ns.route('/search')
@search_ns.doc('search_drills')
class SearchDrills(Resource):
    @search_ns.param('q', 'Search query string', type='string')
    @search_ns.param('corrections', 'Filter by corrections', type='array', items=fields.String)
    @search_ns.marshal_with(search_response, code=200)
    @search_ns.response(500, 'Internal Server Error', error_response)
    def get(self):
        """Search drills by query string (GET)"""
        pass

    @search_ns.expect(search_request)
    @search_ns.marshal_with(search_response, code=200)
    @search_ns.response(500, 'Internal Server Error', error_response)
    def post(self):
        """Search drills by query string or corrections (POST)"""
        pass
