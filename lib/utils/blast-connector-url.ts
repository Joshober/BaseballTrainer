/**
 * Get the Blast Connector server URL (ngrok or local)
 */
export function getBlastConnectorUrl(): string {
  const defaultUrl = 'http://localhost:5002';
  
  // Check for ngrok URL first (for remote backend)
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default
    const ngrokUrl = (process.env.NEXT_PUBLIC_BLAST_CONNECTOR_URL || 
                      process.env.NEXT_PUBLIC_NGROK_BLAST_CONNECTOR_URL);
    
    if (ngrokUrl) {
      return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
    }
    return defaultUrl;
  }
  
  // Server-side: use environment variable or default
  const ngrokUrl = (process.env.BLAST_CONNECTOR_URL || 
                    process.env.NGROK_BLAST_CONNECTOR_URL);
  
  if (ngrokUrl) {
    return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
  }
  
  return defaultUrl;
}

