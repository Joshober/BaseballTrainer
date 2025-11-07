/**
 * Get the backend server URL (ngrok or local)
 * This allows the frontend to connect to a remote backend via ngrok
 */
export function getBackendUrl(): string {
  // Check for ngrok URL first (for remote backend)
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default
    // NEXT_PUBLIC_* variables are available in the browser
    const ngrokUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_NGROK_URL);
    if (ngrokUrl) {
      // Ensure it starts with https://
      return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
    }
    return 'http://localhost:3001';
  }
  
  // Server-side: use environment variable or default
  const ngrokUrl = process.env.NGROK_URL || process.env.BACKEND_URL;
  if (ngrokUrl) {
    return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
  }
  return process.env.LOCAL_SERVER_URL || 'http://localhost:3001';
}

/**
 * Check if ngrok is enabled
 */
export function isNgrokEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return !!(process.env.NEXT_PUBLIC_NGROK_URL || process.env.NEXT_PUBLIC_BACKEND_URL);
  }
  return !!process.env.NGROK_URL;
}

