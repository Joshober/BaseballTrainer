/**
 * Auth0 Client-Side Utilities
 * For use in frontend components
 */
import { getBackendUrl } from '@/lib/utils/backend-url';

export interface Auth0User {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Get stored user info
 */
export function getAuthUser(): Auth0User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('auth_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Sign in with Google
 */
export function signInWithGoogle(): void {
  const gatewayUrl = getBackendUrl();
  window.location.href = `${gatewayUrl}/api/auth/login?connection=google-oauth2`;
}

/**
 * Sign in with email/password
 */
export function signInWithEmail(): void {
  const gatewayUrl = getBackendUrl();
  window.location.href = `${gatewayUrl}/api/auth/login?connection=Username-Password-Authentication`;
}

/**
 * Sign up with Google
 */
export function signUpWithGoogle(): void {
  const gatewayUrl = getBackendUrl();
  window.location.href = `${gatewayUrl}/api/auth/login?connection=google-oauth2&screen_hint=signup`;
}

/**
 * Sign up with email/password
 */
export function signUpWithEmail(): void {
  const gatewayUrl = getBackendUrl();
  window.location.href = `${gatewayUrl}/api/auth/login?connection=Username-Password-Authentication&screen_hint=signup`;
}

/**
 * Sign out
 */
export function signOut(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  const gatewayUrl = getBackendUrl();
  window.location.href = `${gatewayUrl}/api/auth/logout?returnTo=${encodeURIComponent(window.location.origin)}`;
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): string | null {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : null;
}

