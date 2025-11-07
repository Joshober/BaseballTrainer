import admin from 'firebase-admin';
import { config } from '@/lib/utils/config';

let adminApp: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  if (!adminApp) {
    if (admin.apps.length > 0) {
      adminApp = admin.apps[0] as admin.app.App;
    } else {
      if (!config.firebaseAdmin.privateKey) {
        throw new Error('Firebase Admin credentials not configured');
      }
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebaseAdmin.projectId,
          clientEmail: config.firebaseAdmin.clientEmail,
          privateKey: config.firebaseAdmin.privateKey,
        }),
      });
    }
  }
  return adminApp;
}

export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const app = getAdminApp();
    const decodedToken = await app.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

