/**
 * Auth0 Authentication Library
 */
import { useUser, useAuth0 } from '@auth0/nextjs-auth0/client';

export interface Auth0User {
  sub: string; // User ID
  email?: string;
  name?: string;
  picture?: string;
  nickname?: string;
}

/**
 * Get the current Auth0 user
 * This is a client-side hook, so it can only be used in client components
 */
export function useAuth0User() {
  const { user, error, isLoading } = useAuth0();
  return { user, error, isLoading };
}

/**
 * Get Auth0 authentication methods
 */
export function useAuth0Methods() {
  const { loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  return {
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  };
}

/**
 * Sign in with Google using Auth0
 */
export async function signInWithGoogle(): Promise<void> {
  // Auth0 handles this via loginWithRedirect
  // This is a placeholder for compatibility
  throw new Error('Use loginWithRedirect from useAuth0Methods() instead');
}

/**
 * Sign in with email/password using Auth0
 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  // Auth0 handles this via loginWithRedirect
  // This is a placeholder for compatibility
  throw new Error('Use loginWithRedirect from useAuth0Methods() instead');
}

/**
 * Sign up with email/password using Auth0
 */
export async function signUpWithEmail(email: string, password: string): Promise<void> {
  // Auth0 handles this via loginWithRedirect with screen_hint
  // This is a placeholder for compatibility
  throw new Error('Use loginWithRedirect from useAuth0Methods() instead');
}

/**
 * Sign out user
 */
export async function signOutUser(): Promise<void> {
  // Auth0 handles this via logout
  // This is a placeholder for compatibility
  throw new Error('Use logout from useAuth0Methods() instead');
}

/**
 * Get ID token for API calls
 * Returns the access token from Auth0
 */
export async function getIdToken(): Promise<string | null> {
  // This needs to be called from a component with useAuth0 hook
  // For server-side, use getAccessTokenSilently
  throw new Error('Use getAccessTokenSilently from useAuth0Methods() in a component');
}

/**
 * Convert Auth0 user to simplified user format
 */
export function convertAuth0User(auth0User: any): Auth0User | null {
  if (!auth0User) return null;
  
  return {
    sub: auth0User.sub,
    email: auth0User.email,
    name: auth0User.name,
    picture: auth0User.picture,
    nickname: auth0User.nickname,
  };
}

