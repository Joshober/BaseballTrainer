import { config } from './config';

/**
 * Get the storage server URL
 * Supports ngrok URLs for external access
 */
export function getStorageServerUrl(): string {
  // Check for ngrok URL first (for external access)
  if (process.env.NGROK_STORAGE_SERVER_URL) {
    return process.env.NGROK_STORAGE_SERVER_URL;
  }
  
  // Use configured URL or default
  return config.storageServer.url;
}

