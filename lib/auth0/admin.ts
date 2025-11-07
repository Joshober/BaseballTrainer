/**
 * Auth0 Server-Side Token Verification
 * Replaces Firebase Admin token verification
 */
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

let jwksClientInstance: jwksClient.JwksClient | null = null;

/**
 * Get JWKS client for Auth0 token verification
 */
function getJwksClient(): jwksClient.JwksClient {
  if (!jwksClientInstance) {
    const domain = process.env.AUTH0_DOMAIN;
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }
    jwksClientInstance = jwksClient({
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
 * Verify Auth0 access token
 */
export async function verifyAuth0Token(token: string): Promise<any> {
  try {
    const domain = process.env.AUTH0_DOMAIN;
    const audience = process.env.AUTH0_AUDIENCE;
    
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: audience || `https://${domain}/api/v2/`,
          issuer: `https://${domain}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
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
 * Verify ID token from request (replaces Firebase verifyIdToken)
 */
export async function verifyIdToken(token: string): Promise<any> {
  return verifyAuth0Token(token);
}

