import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  Auth,
} from 'firebase/auth';
import { getFirebaseAuth } from './config';

// Get auth instance (may be null if Firebase is disabled)
export function getAuthInstance() {
  return getFirebaseAuth();
}

// Re-export getFirebaseAuth for convenience
export { getFirebaseAuth };

const auth = getAuthInstance();

export async function signInWithGoogle(): Promise<User> {
  const auth = getAuthInstance();
  if (!auth) {
    throw new Error('Firebase Auth is disabled due to billing protection or missing configuration.');
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getAuthInstance();
  if (!auth) {
    throw new Error('Firebase Auth is disabled due to billing protection or missing configuration.');
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const auth = getAuthInstance();
  if (!auth) {
    throw new Error('Firebase Auth is disabled due to billing protection or missing configuration.');
  }
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) return;
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getAuthInstance();
  if (!auth) {
    // Return a no-op unsubscribe function if auth is disabled
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}


