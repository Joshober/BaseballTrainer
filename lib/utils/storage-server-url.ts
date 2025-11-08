import { config } from './config';

/**
 * Get the storage server URL
 * Supports ngrok URLs for external access
 * Works in both server-side and client-side code
 */
export function getStorageServerUrl(): string {
  // Check for client-side ngrok URL first (NEXT_PUBLIC_ prefix)
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_NGROK_STORAGE_SERVER_URL) {
    return process.env.NEXT_PUBLIC_NGROK_STORAGE_SERVER_URL;
  }
  
  // Check for server-side ngrok URL (this is what Next.js API routes use)
  if (process.env.NGROK_STORAGE_SERVER_URL) {
    console.log('[Storage URL] Using NGROK_STORAGE_SERVER_URL:', process.env.NGROK_STORAGE_SERVER_URL);
    return process.env.NGROK_STORAGE_SERVER_URL;
  }
  
  // Use configured URL or default
  const defaultUrl = config.storageServer.url;
  console.log('[Storage URL] Using default URL (ngrok not configured):', defaultUrl);
  return defaultUrl;
}

