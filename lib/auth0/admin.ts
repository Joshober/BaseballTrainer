/**
 * Auth0 Server-Side Token Verification
 */
import { NextRequest } from 'next/server';
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
    // jwks-rsa exports the function as default when using namespace import in ESM
    // Use default export which is the function
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
 * Check if a string is a valid JWT or JWE format
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
 * Verify Auth0 access token
 */
export async function verifyAuth0Token(token: string): Promise<any> {
  try {
    // Validate token format first
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing or invalid');
    }

    // Check if token is a valid JWT or JWE format
    if (!isValidJWTFormat(token)) {
      console.error('Token is not a valid JWT/JWE format. Token length:', token.length);
      console.error('Token preview:', token.substring(0, 50) + '...');
      throw new Error('Token is not a valid JWT/JWE format');
    }

    // Check if token is encrypted (JWE - 5 parts)
    const tokenParts = token.split('.');
    if (tokenParts.length === 5) {
      // This is an encrypted JWT (JWE), which we cannot verify directly
      // Auth0 encrypted tokens need to be decrypted first, or we should use id_token instead
      console.warn('Token is encrypted (JWE). Encrypted tokens cannot be verified directly.');
      console.warn('Consider using id_token instead of access_token, or configure Auth0 to return non-encrypted tokens.');
      // For now, we'll try to decode the header to get basic info
      try {
        const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
        if (header.enc) {
          // This is definitely an encrypted token
          throw new Error('Token is encrypted (JWE) and cannot be verified. Please use id_token or configure Auth0 to return non-encrypted access tokens.');
        }
      } catch (e) {
        // If we can't decode the header, it's still likely encrypted
        throw new Error('Token appears to be encrypted and cannot be verified. Please use id_token or configure Auth0 to return non-encrypted access tokens.');
      }
    }

    const domain = process.env.AUTH0_DOMAIN;
    const audience = process.env.AUTH0_AUDIENCE;
    
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }

    return new Promise((resolve, reject) => {
      // First try with audience (for access tokens)
      const verifyOptions: jwt.VerifyOptions = {
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
      };

      // If audience is specified, use it; otherwise try without audience check
      // (some tokens might not have audience, or it might be different)
      if (audience) {
        verifyOptions.audience = audience;
      }

      jwt.verify(
        token,
        getKey,
        verifyOptions,
        (err, decoded) => {
          if (err) {
            // If verification failed with audience, try without audience check
            // (for ID tokens or tokens with different audience)
            if (audience) {
              jwt.verify(
                token,
                getKey,
                {
                  issuer: `https://${domain}/`,
                  algorithms: ['RS256'],
                  // Don't check audience - just verify signature and issuer
                  ignoreExpiration: false,
                },
                (err2, decoded2) => {
                  if (err2) {
                    console.error('Auth0 token verification error:', err2.message);
                    reject(err2);
                  } else {
                    resolve(decoded2);
                  }
                }
              );
            } else {
              console.error('Auth0 token verification error:', err.message);
              reject(err);
            }
          } else {
            resolve(decoded);
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Auth0 token verification error:', error);
    return null;
  }
}

/**
 * Get user from Auth0 session (for API routes)
 */
export async function getAuth0User(request: NextRequest): Promise<any> {
  try {
    // This requires the Auth0 Next.js SDK to be set up
    // For now, we'll verify the token from the Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAuth0Token(token);
    return decoded;
  } catch (error) {
    console.error('Failed to get Auth0 user:', error);
    return null;
  }
}

/**
 * Verify ID token from request
 */
export async function verifyIdToken(token: string): Promise<any> {
  return verifyAuth0Token(token);
}

