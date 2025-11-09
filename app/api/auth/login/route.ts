import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/utils/backend-url';

/**
 * Next.js API route for auth login
 * This route redirects to the backend gateway which handles Auth0 authentication
 */
export async function GET(request: NextRequest) {
  try {
    const gatewayUrl = getBackendUrl();
    const searchParams = request.nextUrl.searchParams;
    
    // Build the redirect URL with all query parameters
    const connection = searchParams.get('connection') || 'google-oauth2';
    const screenHint = searchParams.get('screen_hint') || 'login';
    
    // Redirect to backend gateway
    const redirectUrl = new URL(`${gatewayUrl}/api/auth/login`);
    redirectUrl.searchParams.set('connection', connection);
    if (screenHint) {
      redirectUrl.searchParams.set('screen_hint', screenHint);
    }
    
    // Preserve any other query parameters
    searchParams.forEach((value, key) => {
      if (key !== 'connection' && key !== 'screen_hint') {
        redirectUrl.searchParams.set(key, value);
      }
    });
    
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Auth login redirect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

