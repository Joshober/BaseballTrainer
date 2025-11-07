"""
Swagger/OpenAPI documentation for storage server
"""
from flask import Blueprint, jsonify

swagger_bp = Blueprint('swagger', __name__)

@swagger_bp.route('/api/docs', methods=['GET'])
def swagger_docs():
    """Swagger API documentation"""
    return jsonify({
        'openapi': '3.0.0',
        'info': {
            'title': 'Storage Server API',
            'version': '1.0.0',
            'description': 'API for video and image storage'
        },
        'paths': {
            '/api/storage/upload': {
                'post': {
                    'summary': 'Upload a file',
                    'description': 'Upload a video or image file to storage',
                    'security': [{'BearerAuth': []}],
                    'requestBody': {
                        'required': True,
                        'content': {
                            'multipart/form-data': {
                                'schema': {
                                    'type': 'object',
                                    'properties': {
                                        'file': {'type': 'string', 'format': 'binary'},
                                        'path': {'type': 'string', 'description': 'Optional custom path'}
                                    },
                                    'required': ['file']
                                }
                            }
                        }
                    },
                    'responses': {
                        '200': {'description': 'File uploaded successfully'},
                        '400': {'description': 'Bad request'},
                        '401': {'description': 'Unauthorized'}
                    }
                }
            },
            '/api/storage/{path}': {
                'get': {
                    'summary': 'Get a file',
                    'description': 'Retrieve a file from storage',
                    'parameters': [{
                        'name': 'path',
                        'in': 'path',
                        'required': True,
                        'schema': {'type': 'string'}
                    }],
                    'responses': {
                        '200': {'description': 'File retrieved successfully'},
                        '404': {'description': 'File not found'}
                    }
                }
            },
            '/api/storage': {
                'delete': {
                    'summary': 'Delete a file',
                    'description': 'Delete a file from storage',
                    'security': [{'BearerAuth': []}],
                    'parameters': [{
                        'name': 'path',
                        'in': 'query',
                        'required': True,
                        'schema': {'type': 'string'}
                    }],
                    'responses': {
                        '200': {'description': 'File deleted successfully'},
                        '403': {'description': 'Forbidden'},
                        '404': {'description': 'File not found'}
                    }
                }
            }
        }
    })

