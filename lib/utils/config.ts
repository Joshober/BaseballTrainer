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
    uri: process.env.MONGODB_URI || '',
  },
  // Storage & Database toggles
  storageType: (process.env.STORAGE_TYPE || 'firebase') as 'firebase' | 'local',
  databaseType: (process.env.DATABASE_TYPE || 'firestore') as 'firestore' | 'mongodb',
  // Local server
  localServer: {
    url: process.env.LOCAL_SERVER_URL || 'http://localhost:3001',
    port: parseInt(process.env.EXPRESS_SERVER_PORT || '3001', 10),
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

  if (config.storageType === 'firebase') {
    if (!config.firebase.storageBucket) errors.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required');
  }

  if (config.storageType === 'local') {
    if (!config.localServer.url) errors.push('LOCAL_SERVER_URL is required');
  }

  if (errors.length > 0) {
    console.warn('Configuration validation errors:', errors);
  }

  return errors.length === 0;
}

