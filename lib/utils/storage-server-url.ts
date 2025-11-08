import { config } from './config';

/**
 * Get the storage server URL
 * Prioritizes localhost/STORAGE_SERVER_URL over ngrok URLs
 * Works in both server-side and client-side code
 */
export function getStorageServerUrl(): string {
  const defaultUrl = 'http://localhost:5003';
  
  // Check if we're on the client side (browser)
  const isClient = typeof window !== 'undefined';
  
  if (isClient) {
    // On client side, use NEXT_PUBLIC_ prefixed env var or default
    const clientUrl = process.env.NEXT_PUBLIC_STORAGE_SERVER_URL || defaultUrl;
    // Ensure it's a valid non-empty string
    if (clientUrl && typeof clientUrl === 'string' && clientUrl.trim()) {
      console.log('[Storage URL] Client-side, using:', clientUrl);
      return clientUrl.trim();
    }
    console.log('[Storage URL] Client-side, using default:', defaultUrl);
    return defaultUrl;
  }
  
  // Server-side: prefer explicit STORAGE_SERVER_URL (local-first, no ngrok)
  const serverUrl = process.env.STORAGE_SERVER_URL;
  if (serverUrl && typeof serverUrl === 'string' && serverUrl.trim()) {
    console.log('[Storage URL] Using STORAGE_SERVER_URL:', serverUrl);
    return serverUrl.trim();
  }

  // Fall back to plain localhost (no ngrok)
  console.log('[Storage URL] Using default URL (localhost):', defaultUrl);
  return defaultUrl;
}

