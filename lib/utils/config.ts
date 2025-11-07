export const config = {
  // Auth0 configuration (loaded from .env.local)
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    audience: process.env.AUTH0_AUDIENCE || '',
    scope: process.env.AUTH0_SCOPE || 'openid profile email',
    baseURL: process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_AUTH0_BASE_URL || '',
    secret: process.env.AUTH0_SECRET || '',
  },
  // MongoDB
  mongodb: {
    uri: (process.env.MONGODB_URI || '').replace(/^["']|["']$/g, ''), // Remove quotes if present
  },
  // Storage & Database toggles
  storageType: 'local' as const, // Always use local storage
  databaseType: 'mongodb' as const, // Only MongoDB supported
  // Pose Detection Service
  poseDetectionService: {
    url: process.env.POSE_DETECTION_SERVICE_URL || process.env.NGROK_POSE_DETECTION_URL || 'http://localhost:5000',
    port: parseInt(process.env.POSE_DETECTION_SERVICE_PORT || '5000', 10),
  },
  drillRecommender: {
    url: process.env.DRILL_RECOMMENDER_URL || process.env.NGROK_DRILL_RECOMMENDER_URL || 'http://localhost:5001',
    port: parseInt(process.env.DRILL_RECOMMENDER_PORT || '5001', 10),
  },
  blastConnector: {
    url: process.env.BLAST_CONNECTOR_URL || process.env.NGROK_BLAST_CONNECTOR_URL || 'http://localhost:5002',
    port: parseInt(process.env.BLAST_CONNECTOR_PORT || '5002', 10),
  },
  storageServer: {
    url: process.env.STORAGE_SERVER_URL || process.env.NGROK_STORAGE_SERVER_URL || 'http://localhost:5003',
    port: parseInt(process.env.STORAGE_SERVER_PORT || '5003', 10),
  },
  gateway: {
    url: process.env.GATEWAY_URL || process.env.NGROK_GATEWAY_URL || 'http://localhost:3001',
    port: parseInt(process.env.GATEWAY_PORT || '3001', 10),
  },
  // Ngrok configuration
  ngrok: {
    enabled: !!process.env.NGROK_URL,
    url: process.env.NGROK_URL || '',
    frontendUrl: process.env.NEXT_PUBLIC_NGROK_FRONTEND_URL || process.env.NGROK_FRONTEND_URL || '',
    frontendEnabled: !!(process.env.NEXT_PUBLIC_NGROK_FRONTEND_URL || process.env.NGROK_FRONTEND_URL),
  },
} as const;

// Validation
export function validateConfig() {
  const errors: string[] = [];

  // Only MongoDB is supported
  if (config.databaseType === 'mongodb') {
    if (!config.mongodb.uri) errors.push('MONGODB_URI is required');
  }

  // Local storage is always used - no validation needed

  if (errors.length > 0) {
    console.warn('Configuration validation errors:', errors);
  }

  return errors.length === 0;
}


