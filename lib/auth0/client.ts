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
 * Validate if a token is a valid JWT or JWE format
 * JWT: 3 parts (header.payload.signature)
 * JWE: 5 parts (header.encrypted_key.iv.ciphertext.tag)
 */
function isValidJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const parts = token.split('.');
  // Accept both JWT (3 parts) and JWE (5 parts) formats
  return (parts.length === 3 || parts.length === 5) && parts.every(part => part.length > 0);
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('auth_token');
  
  // Validate token format before returning
  if (token && !isValidJWTFormat(token)) {
    console.error('Invalid token format in localStorage. Clearing token.');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return null;
  }
  
  return token;
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
export async function signInWithEmail(email: string, password: string): Promise<{ access_token: string; user: Auth0User } | null> {
  const gatewayUrl = getBackendUrl();
  try {
    const response = await fetch(`${gatewayUrl}/api/auth/login-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    const data = await response.json();
    
    // Store tokens
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    
    return {
      access_token: data.access_token,
      user: data.user,
    };
  } catch (error: any) {
    console.error('Email login error:', error);
    throw error;
  }
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
 * After successful signup, user needs to sign in
 */
export async function signUpWithEmail(email: string, password: string): Promise<{ success: boolean; email: string; message: string } | null> {
  const gatewayUrl = getBackendUrl();
  try {
    const response = await fetch(`${gatewayUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Registration failed');
    }
    
    const data = await response.json();
    
    // After successful signup, automatically sign them in
    // Use the login endpoint to authenticate
    try {
      const loginResult = await signInWithEmail(email, password);
      return loginResult ? { success: true, email, message: 'Account created and signed in successfully' } : null;
    } catch (loginError: any) {
      // If login fails, return success but indicate they need to sign in
      return {
        success: true,
        email,
        message: 'Account created successfully. Please sign in.',
      };
    }
  } catch (error: any) {
    console.error('Email registration error:', error);
    throw error;
  }
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

