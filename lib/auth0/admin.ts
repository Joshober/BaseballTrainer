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
  try {
    // Only log in debug mode
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('getKey called with header:', { kid: header.kid, alg: header.alg, typ: header.typ });
    }
    const client = getJwksClient();
    if (!header.kid) {
      console.error('Token header missing kid (key ID)');
      return callback(new Error('Token header missing kid (key ID)'));
    }
    // Only log in debug mode
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('Fetching signing key from JWKS for kid:', header.kid);
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('Error fetching signing key from JWKS:', err.message);
        return callback(err);
      }
      if (!key) {
        console.error('Signing key not found for kid:', header.kid);
        return callback(new Error('Signing key not found'));
      }
      try {
        const signingKey = key.getPublicKey();
        if (!signingKey) {
          console.error('Failed to extract public key from signing key');
          return callback(new Error('Failed to extract public key from signing key'));
        }
        // Only log in debug mode
        if (process.env.DEBUG_AUTH === 'true') {
          console.log('Successfully retrieved signing key for kid:', header.kid);
        }
        callback(null, signingKey);
      } catch (keyErr: any) {
        console.error('Error extracting public key:', keyErr.message);
        callback(keyErr);
      }
    });
  } catch (error: any) {
    console.error('Error in getKey function:', error.message);
    callback(error);
  }
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
    // Normalize: strip optional 'Bearer ' prefix and trim
    if (typeof token === 'string') {
      token = token.replace(/^Bearer\s+/i, '').trim();
    }
    
    // Validate token format first
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing or invalid');
    }

    if (token.length === 0) {
      throw new Error('Token is empty');
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

    // Try to decode the token first to see what we're working with
    let unverifiedDecode: any = null;
    try {
      unverifiedDecode = jwt.decode(token, { complete: true });
      // Only log in debug mode
      if (process.env.DEBUG_AUTH === 'true' && unverifiedDecode) {
        console.log('Token decoded (unverified) before verification:', {
          header: unverifiedDecode.header,
          payload: {
            iss: (unverifiedDecode.payload as any)?.iss,
            aud: (unverifiedDecode.payload as any)?.aud,
            exp: (unverifiedDecode.payload as any)?.exp,
            iat: (unverifiedDecode.payload as any)?.iat,
            sub: (unverifiedDecode.payload as any)?.sub,
            expDate: (unverifiedDecode.payload as any)?.exp ? new Date((unverifiedDecode.payload as any).exp * 1000).toISOString() : null,
            now: new Date().toISOString(),
          }
        });
      }
    } catch (decodeErr) {
      // Only log errors in debug mode
      if (process.env.DEBUG_AUTH === 'true') {
        console.error('Failed to decode token before verification:', decodeErr);
      }
    }

    // Only log in debug mode
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('Starting token verification with:', {
        domain,
        audience: audience || 'none',
        expectedIssuer: `https://${domain}/`,
      });
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
        // Only log in debug mode
        if (process.env.DEBUG_AUTH === 'true') {
          console.log('Verifying with audience:', audience);
        }
      } else {
        // Only log in debug mode
        if (process.env.DEBUG_AUTH === 'true') {
          console.log('Verifying without audience check');
        }
      }

      jwt.verify(
        token,
        getKey,
        verifyOptions,
        (err, decoded) => {
          if (err) {
            // Log the specific error for debugging
            const errorMessage = err.message || 'Unknown error';
            const errorName = err.name || 'JWTError';
            console.error(`Auth0 token verification error (first attempt): ${errorName}: ${errorMessage}`);
            
            // If verification failed with audience, try without audience check
            // (for ID tokens or tokens with different audience)
            if (audience) {
              // Only log in debug mode
              if (process.env.DEBUG_AUTH === 'true') {
                console.log('Retrying token verification without audience check...');
              }
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
                    const errorMessage2 = err2.message || 'Unknown error';
                    const errorName2 = err2.name || 'JWTError';
                    console.error(`Auth0 token verification error (retry without audience): ${errorName2}: ${errorMessage2}`);
                    
                    // Only log detailed info in debug mode
                    if (process.env.DEBUG_AUTH === 'true') {
                      // Try to decode without verification to get more info
                      try {
                        const unverified = jwt.decode(token, { complete: true });
                        if (unverified) {
                          console.error('Token decoded (unverified):', {
                            header: unverified.header,
                            payload: {
                              iss: (unverified.payload as any)?.iss,
                              aud: (unverified.payload as any)?.aud,
                              exp: (unverified.payload as any)?.exp,
                              iat: (unverified.payload as any)?.iat,
                              sub: (unverified.payload as any)?.sub,
                            }
                          });
                        }
                      } catch (decodeErr) {
                        console.error('Failed to decode token:', decodeErr);
                      }
                    }
                    
                    reject(err2);
                  } else {
                    // Only log in debug mode
                    if (process.env.DEBUG_AUTH === 'true') {
                      console.log('Token verification succeeded without audience check');
                    }
                    resolve(decoded2);
                  }
                }
              );
            } else {
              // Try to decode without verification to get more info
              try {
                const unverified = jwt.decode(token, { complete: true });
                if (unverified) {
                  console.error('Token decoded (unverified):', {
                    header: unverified.header,
                    payload: {
                      iss: (unverified.payload as any)?.iss,
                      aud: (unverified.payload as any)?.aud,
                      exp: (unverified.payload as any)?.exp,
                      iat: (unverified.payload as any)?.iat,
                      sub: (unverified.payload as any)?.sub,
                    }
                  });
                }
              } catch (decodeErr) {
                console.error('Failed to decode token:', decodeErr);
              }
              
              reject(err);
            }
          } else {
            resolve(decoded);
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Auth0 token verification error:', error?.message || error);
    throw error; // Re-throw instead of returning null to preserve error information
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

    const token = authHeader.substring(7).trim();
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

