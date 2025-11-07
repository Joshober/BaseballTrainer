/**
 * Auth0 Configuration
 */
import { config } from '@/lib/utils/config';

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret?: string;
  audience?: string;
  scope?: string;
}

/**
 * Get Auth0 configuration from environment variables
 */
export function getAuth0Config(): Auth0Config {
  return {
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    audience: process.env.AUTH0_AUDIENCE || '',
    scope: process.env.AUTH0_SCOPE || 'openid profile email',
  };
}

/**
 * Check if Auth0 is configured
 */
export function isAuth0Configured(): boolean {
  const auth0Config = getAuth0Config();
  return !!(auth0Config.domain && auth0Config.clientId);
}

