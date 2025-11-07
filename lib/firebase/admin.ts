import admin from 'firebase-admin';
import { config } from '@/lib/utils/config';

let adminApp: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  if (!adminApp) {
    if (admin.apps.length > 0) {
      adminApp = admin.apps[0] as admin.app.App;
    } else {
      // Check if Firebase Admin is configured
      if (!config.firebaseAdmin.privateKey || !config.firebaseAdmin.projectId || !config.firebaseAdmin.clientEmail) {
        const missing = [];
        if (!config.firebaseAdmin.projectId) missing.push('FIREBASE_ADMIN_PROJECT_ID');
        if (!config.firebaseAdmin.clientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL');
        if (!config.firebaseAdmin.privateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY');
        throw new Error(
          `Firebase Admin SDK not configured. Missing: ${missing.join(', ')}. ` +
          `Please add these to .env.local. See docs/FIREBASE_SETUP.md for instructions.`
        );
      }

      // Verify project IDs match (client and admin should use same project)
      if (config.firebase.projectId && config.firebaseAdmin.projectId !== config.firebase.projectId) {
        console.warn(
          `Warning: Firebase client project ID (${config.firebase.projectId}) doesn't match ` +
          `Admin project ID (${config.firebaseAdmin.projectId}). They should be the same.`
        );
      }

      try {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebaseAdmin.projectId,
            clientEmail: config.firebaseAdmin.clientEmail,
            privateKey: config.firebaseAdmin.privateKey,
          }),
        });
      } catch (error: any) {
        throw new Error(
          `Failed to initialize Firebase Admin SDK: ${error.message}. ` +
          `Please check your FIREBASE_ADMIN_PRIVATE_KEY format in .env.local`
        );
      }
    }
  }
  return adminApp;
}

export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const app = getAdminApp();
    const decodedToken = await app.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    // If it's an initialization error (Admin SDK not configured), log it clearly
    if (error.message && error.message.includes('Firebase Admin SDK not configured')) {
      console.error('Firebase Admin SDK Error:', error.message);
      throw error; // Re-throw so API routes can return proper error
    }
    
    // For token verification errors, log details but return null
    console.error('Token verification error:', {
      message: error.message,
      code: error.code,
      error: error.toString(),
    });
    
    // Return null for token verification failures (invalid/expired token)
    return null;
  }
}


