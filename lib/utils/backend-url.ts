/**
 * Get the backend gateway URL (main backend that routes to Flask services)
 * This allows the frontend to connect to the main backend gateway
 */
export function getBackendUrl(): string {
  const defaultUrl = 'http://localhost:3001';
  
  // Check for ngrok URL first (for remote backend)
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default
    // NEXT_PUBLIC_* variables are available in the browser
    const ngrokUrl = (process.env.NEXT_PUBLIC_GATEWAY_URL || 
                      process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_NGROK_URL);
    
    if (ngrokUrl) {
      // Ensure it starts with http:// or https://
      return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
    }
    return defaultUrl;
  }
  
  // Server-side: use environment variable or default
  const ngrokUrl = (process.env.GATEWAY_URL || 
                    process.env.BACKEND_URL ||
                    process.env.NGROK_URL);
  
  if (ngrokUrl) {
    return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
  }
  
  return process.env.GATEWAY_URL || defaultUrl;
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

