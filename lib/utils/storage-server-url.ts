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
  
  // Check for server-side ngrok URL
  if (process.env.NGROK_STORAGE_SERVER_URL) {
    return process.env.NGROK_STORAGE_SERVER_URL;
  }
  
  // Use configured URL or default
  return config.storageServer.url;
}

