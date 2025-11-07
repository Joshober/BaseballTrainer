/**
 * Get the drill recommender server URL (ngrok or local)
 */
export function getDrillRecommenderUrl(): string {
  const defaultUrl = 'http://localhost:5001';
  
  // Check for ngrok URL first (for remote backend)
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default
    const ngrokUrl = (process.env.NEXT_PUBLIC_DRILL_RECOMMENDER_URL || 
                      process.env.NEXT_PUBLIC_NGROK_DRILL_RECOMMENDER_URL);
    
    if (ngrokUrl) {
      return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
    }
    return defaultUrl;
  }
  
  // Server-side: use environment variable or default
  const ngrokUrl = (process.env.DRILL_RECOMMENDER_URL || 
                    process.env.NGROK_DRILL_RECOMMENDER_URL);
  
  if (ngrokUrl) {
    return ngrokUrl.startsWith('http') ? ngrokUrl : `https://${ngrokUrl}`;
  }
  
  return defaultUrl;
}

