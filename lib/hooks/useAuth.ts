/**
 * Auth0 Authentication Hook
 * Provides auth state management similar to Firebase's onAuthChange
 */
import { useState, useEffect, useCallback } from 'react';
import { getAuthUser, getAuthToken, type Auth0User } from '@/lib/auth0/client';

export function useAuth() {
  const [user, setUser] = useState<Auth0User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth state on mount
    const checkAuth = () => {
      const authUser = getAuthUser();
      const token = getAuthToken();
      
      if (authUser && token) {
        setUser(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Poll for auth changes (since Auth0 doesn't have real-time listeners)
    // Check every 1 second for changes
    const interval = setInterval(checkAuth, 1000);

    // Also listen for storage events (for cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'auth_user') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { user, loading };
}

/**
 * onAuthChange equivalent for Auth0
 * Returns an unsubscribe function
 * Only calls callback when user actually changes
 */
export function onAuthChange(callback: (user: Auth0User | null) => void): () => void {
  let isSubscribed = true;
  let lastUser: Auth0User | null = null;

  const checkAuth = () => {
    if (!isSubscribed) return;
    
    const authUser = getAuthUser();
    const token = getAuthToken();
    
    const currentUser = (authUser && token) ? authUser : null;
    
    // Only call callback if user has actually changed
    if (currentUser?.sub !== lastUser?.sub) {
      lastUser = currentUser;
      callback(currentUser);
    }
  };

  // Initial check
  checkAuth();

  // Poll for changes (less frequently - every 5 seconds instead of 1 second)
  const interval = setInterval(checkAuth, 5000);

  // Listen for storage events (for cross-tab updates)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'auth_token' || e.key === 'auth_user') {
      checkAuth();
    }
  };

  window.addEventListener('storage', handleStorageChange);

  // Return unsubscribe function
  return () => {
    isSubscribed = false;
    clearInterval(interval);
    window.removeEventListener('storage', handleStorageChange);
  };
}

