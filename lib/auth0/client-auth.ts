/**
 * Auth0 Client-Side Auth Helper
 * Provides Auth0 authentication functions for client-side components
 */
'use client';

import { getAuthToken, getAuthUser, signOut as auth0SignOut } from './client';

export interface Auth0User {
  uid: string; // Maps to Auth0 'sub'
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Convert Auth0 user to simplified user format
 */
function convertAuth0User(auth0User: any): Auth0User | null {
  if (!auth0User) return null;
  
  return {
    uid: auth0User.sub || auth0User.user_id || '',
    email: auth0User.email || null,
    displayName: auth0User.name || auth0User.nickname || null,
    photoURL: auth0User.picture || null,
  };
}

/**
 * Get Auth0 auth instance
 * Returns an object with the current user
 */
export function getAuth(): { currentUser: Auth0User | null } {
  return {
    currentUser: convertAuth0User(getAuthUser()),
  };
}

/**
 * Listen to auth state changes
 * Returns unsubscribe function
 * Uses storage events to detect auth changes across tabs
 */
export function onAuthChange(callback: (user: Auth0User | null) => void): () => void {
  // Check initial state
  let lastUser = convertAuth0User(getAuthUser());
  callback(lastUser);
  
  // Listen for storage changes (auth tokens stored in localStorage)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'auth_token' || e.key === 'auth_user') {
      const newUser = convertAuth0User(getAuthUser());
      if (newUser?.uid !== lastUser?.uid) {
        lastUser = newUser;
        callback(newUser);
      }
    }
  };
  
  // Also check periodically in case storage events don't fire (same-tab changes)
  let intervalId: NodeJS.Timeout | null = null;
  const checkAuth = () => {
    const newUser = convertAuth0User(getAuthUser());
    if (newUser?.uid !== lastUser?.uid) {
      lastUser = newUser;
      callback(newUser);
    }
  };
  
  // Poll every 2 seconds for auth changes
  intervalId = setInterval(checkAuth, 2000);
  
  // Listen for storage events
  window.addEventListener('storage', handleStorageChange);
  
  // Return unsubscribe function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    window.removeEventListener('storage', handleStorageChange);
  };
}

/**
 * Get ID token for API calls
 */
export async function getIdToken(forceRefresh: boolean = false): Promise<string | null> {
  return getAuthToken();
}

/**
 * Sign out user
 */
export async function signOutUser(): Promise<void> {
  auth0SignOut();
}

/**
 * Ensure user is signed in; if not, redirect to login preserving return path
 */
export function ensureSignedIn(returnTo?: string) {
  const token = getAuthToken();
  const user = getAuthUser();
  if (!token || !user) {
    try {
      const rt = returnTo || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
      const url = new URL('/login', window.location.origin);
      url.searchParams.set('returnTo', rt);
      window.location.href = url.toString();
    } catch {
      // Fallback
      window.location.href = '/login';
    }
  }
}


