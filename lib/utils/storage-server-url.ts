import { config } from './config';

/**
 * Get the storage server URL
 * Storage is handled by the Pose Detection Service (which includes storage routes)
 * Supports ngrok URLs for external access
 * Works in both server-side and client-side code
 */
export function getStorageServerUrl(): string {
  // Check for client-side ngrok URL first (NEXT_PUBLIC_ prefix)
  // Prefer storage-specific URL, fall back to pose detection service URL
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_NGROK_STORAGE_SERVER_URL) {
      return process.env.NEXT_PUBLIC_NGROK_STORAGE_SERVER_URL;
    }
    if (process.env.NEXT_PUBLIC_NGROK_POSE_DETECTION_URL) {
      return process.env.NEXT_PUBLIC_NGROK_POSE_DETECTION_URL;
    }
  }
  
  // Check for server-side ngrok URL (this is what Next.js API routes use)
  // Prefer storage-specific URL, fall back to pose detection service URL
  if (process.env.NGROK_STORAGE_SERVER_URL) {
    console.log('[Storage URL] Using NGROK_STORAGE_SERVER_URL:', process.env.NGROK_STORAGE_SERVER_URL);
    return process.env.NGROK_STORAGE_SERVER_URL;
  }
  if (process.env.NGROK_POSE_DETECTION_URL) {
    console.log('[Storage URL] Using NGROK_POSE_DETECTION_URL (storage routes included):', process.env.NGROK_POSE_DETECTION_URL);
    return process.env.NGROK_POSE_DETECTION_URL;
  }
  
  // Use configured URL or default to pose detection service (which includes storage)
  const defaultUrl = config.storageServer.url;
  console.log('[Storage URL] Using pose detection service (includes storage routes):', defaultUrl);
  return defaultUrl;
}

