/**
 * Auth0 Token Verification for Backend Gateway
 * Standalone version without Next.js dependencies
 */
import * as jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';
import type { JwksClient } from 'jwks-rsa';

let jwksClientInstance: JwksClient | null = null;

/**
 * Get JWKS client for Auth0 token verification
 */
function getJwksClient(): JwksClient {
  if (!jwksClientInstance) {
    const domain = process.env.AUTH0_DOMAIN;
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }
    const jwksClientFn = (jwksRsa as any).default;
    if (typeof jwksClientFn !== 'function') {
      throw new Error('jwks-rsa default export is not a function');
    }
    jwksClientInstance = jwksClientFn({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
    });
  }
  return jwksClientInstance;
}

/**
 * Get signing key for JWT verification
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  const client = getJwksClient();
  client.getSigningKey(header.kid || '', (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Check if a string is a valid JWT format
 */
function isValidJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const parts = token.split('.');
  return (parts.length === 3 || parts.length === 5) && parts.every(part => part.length > 0);
}

/**
 * Verify Auth0 token (ID token or access token)
 */
export async function verifyIdToken(token: string): Promise<any> {
  try {
    // Validate token format first
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing or invalid');
    }

    // Check if token is a valid JWT or JWE format
    if (!isValidJWTFormat(token)) {
      console.error('Token is not a valid JWT/JWE format. Token length:', token.length);
      throw new Error('Token is not a valid JWT/JWE format');
    }

    // Check if token is encrypted (JWE - 5 parts)
    const tokenParts = token.split('.');
    if (tokenParts.length === 5) {
      console.warn('Token is encrypted (JWE). Encrypted tokens cannot be verified directly.');
      throw new Error('Token is encrypted (JWE) and cannot be verified. Please use id_token or configure Auth0 to return non-encrypted access tokens.');
    }

    const domain = process.env.AUTH0_DOMAIN;
    const audience = process.env.AUTH0_AUDIENCE;
    const clientId = process.env.AUTH0_CLIENT_ID;
    
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }

    return new Promise((resolve, reject) => {
      const issuer = `https://${domain}/`;
      const audiences = [];
      if (audience) audiences.push(audience);
      if (clientId) audiences.push(clientId);
      
      // Try verification with each audience, then without audience
      const tryVerify = (audIndex: number, triedWithoutAudience: boolean) => {
        const options: jwt.VerifyOptions = {
          issuer,
          algorithms: ['RS256'],
        };
        
        // If we have an audience at this index, use it
        if (audIndex < audiences.length) {
          options.audience = audiences[audIndex];
        }
        // Otherwise, try without audience (if we haven't already)
        
        jwt.verify(token, getKey, options, (err, decoded) => {
          if (!err && decoded) {
            return resolve(decoded);
          }
          
          // Try next audience
          if (audIndex + 1 < audiences.length) {
            return tryVerify(audIndex + 1, triedWithoutAudience);
          }
          
          // If we've tried all audiences, try without audience as last resort
          if (!triedWithoutAudience) {
            return tryVerify(audiences.length, true);
          }
          
          // All attempts failed
          console.error('Auth0 token verification failed after all attempts:', err?.message || 'Unknown error');
          reject(err || new Error('Token verification failed'));
        });
      };
      
      // Start with first audience, or without audience if none specified
      if (audiences.length > 0) {
        tryVerify(0, false);
      } else {
        tryVerify(0, false); // Will try without audience
      }
    });
  } catch (error: any) {
    console.error('Auth0 token verification error:', error);
    return null;
  }
}

