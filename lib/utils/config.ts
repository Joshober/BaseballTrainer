export const config = {
  // Firebase
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  },
  firebaseAdmin: {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },
  // MongoDB
  mongodb: {
    uri: (process.env.MONGODB_URI || '').replace(/^["']|["']$/g, ''), // Remove quotes if present
  },
  // Storage & Database toggles
  storageType: 'local' as const, // Always use local storage
  databaseType: (process.env.DATABASE_TYPE || 'mongodb') as 'firestore' | 'mongodb',
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

  if (config.databaseType === 'firestore') {
    if (!config.firebase.apiKey) errors.push('NEXT_PUBLIC_FIREBASE_API_KEY is required');
    if (!config.firebase.projectId) errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required');
  }

  if (config.databaseType === 'mongodb') {
    if (!config.mongodb.uri) errors.push('MONGODB_URI is required');
  }

  // Local storage is always used - no validation needed

  if (errors.length > 0) {
    console.warn('Configuration validation errors:', errors);
  }

  return errors.length === 0;
}


