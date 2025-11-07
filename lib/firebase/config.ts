import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { config } from '@/lib/utils/config';
import { shouldDisableFirebase, shouldDisableFirebaseAuth } from './billing-protection';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let firebaseDisabled = false;

/**
 * Check if Firebase is properly configured
 */
function isFirebaseConfigured(): boolean {
  // Allow app to run without Firebase if using local storage/database
  if (config.storageType === 'local' && config.databaseType === 'mongodb') {
    return false; // Firebase not needed
  }
  
  return !!(
    config.firebase.apiKey &&
    config.firebase.projectId &&
    config.firebase.apiKey !== 'your_api_key' &&
    config.firebase.projectId !== 'your_project_id' &&
    config.firebase.apiKey !== ''
  );
}

/**
 * Check if Firebase should be disabled (billing protection or missing config)
 * Note: Auth is separate - it's FREE on Spark plan
 */
function shouldDisable(): boolean {
  // Check if Firebase is configured
  if (!isFirebaseConfigured()) {
    return true;
  }
  
  // Check billing protection (for paid services like Firestore/Storage)
  if (shouldDisableFirebase()) {
    return true;
  }
  
  return false;
}

/**
 * Check if Firebase Auth should be disabled
 * Auth is FREE on Spark plan, so we allow it even if other services are disabled
 */
function shouldDisableAuth(): boolean {
  // Check if Firebase is configured
  if (!isFirebaseConfigured()) {
    return true;
  }
  
  // Auth is FREE, so only disable if explicitly configured
  if (shouldDisableFirebaseAuth()) {
    return true;
  }
  
  return false;
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please add Firebase credentials to .env.local or use local storage/database.');
  }
  
  if (shouldDisable()) {
    firebaseDisabled = true;
    throw new Error('Firebase is disabled due to billing protection. Please configure billing limits or use local storage/database.');
  }
  
  if (!app) {
    const apps = getApps();
    if (apps.length > 0) {
      app = apps[0];
    } else {
      app = initializeApp(config.firebase);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  // Allow app to run without Firebase if not configured
  if (!isFirebaseConfigured()) {
    return null;
  }
  
  // Auth is FREE on Spark plan, so we use separate check
  if (shouldDisableAuth()) {
    firebaseDisabled = true;
    console.warn('Firebase Auth is disabled (not configured or explicitly disabled).');
    return null;
  }
  
  if (!auth) {
    try {
      auth = getAuth(getFirebaseApp());
    } catch (error) {
      console.warn('Firebase Auth initialization failed:', error);
      return null;
    }
  }
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  // Allow app to run without Firebase if not configured
  if (!isFirebaseConfigured()) {
    return null;
  }
  
  if (shouldDisable()) {
    firebaseDisabled = true;
    console.warn('Firestore is disabled due to billing protection.');
    return null;
  }
  
  if (!db) {
    try {
      db = getFirestore(getFirebaseApp());
    } catch (error) {
      console.warn('Firestore initialization failed:', error);
      return null;
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  // Allow app to run without Firebase if not configured
  if (!isFirebaseConfigured()) {
    return null;
  }
  
  if (shouldDisable()) {
    firebaseDisabled = true;
    console.warn('Firebase Storage is disabled due to billing protection.');
    return null;
  }
  
  if (!storage) {
    try {
      storage = getStorage(getFirebaseApp());
    } catch (error) {
      console.warn('Firebase Storage initialization failed:', error);
      return null;
    }
  }
  return storage;
}

export function isFirebaseDisabled(): boolean {
  return firebaseDisabled || shouldDisable();
}


