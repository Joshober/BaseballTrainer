import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/utils/backend-url';

/**
 * Next.js API route for Claude video analysis via OpenRouter
 * This route proxies requests to the main backend gateway
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get JSON body - accept either session_id or video_id
    const body = await request.json();
    const { session_id, video_id } = body;

    if (!session_id && !video_id) {
      return NextResponse.json({ 
        error: 'session_id or video_id is required' 
      }, { status: 400 });
    }

    // Proxy to main backend gateway
    const gatewayUrl = getBackendUrl();
    const gatewayApiUrl = `${gatewayUrl}/api/pose/analyze-video-claude`;

    console.log(`Proxying to gateway: ${gatewayApiUrl} with video_id: ${video_id}`);

    // Forward request to gateway (which will route to Python backend)
    let response: Response;
    try {
      // Create abort controller for timeout (5 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
      
      response = await fetch(gatewayApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id, video_id }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error('Failed to connect to gateway:', fetchError);
      // Check if it's a network error
      if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNREFUSED' || fetchError.message?.includes('fetch')) {
        return NextResponse.json(
          { 
            error: 'Backend gateway not available', 
            message: 'The backend gateway is not running. Please ensure it is started on port 3001.',
            ok: false 
          },
          { status: 503 }
        );
      }
      throw fetchError;
    }

    let result: any;
    try {
      result = await response.json();
    } catch (jsonError) {
      // If response is not JSON, get text
      const text = await response.text();
      console.error('Gateway returned non-JSON response:', text);
      return NextResponse.json(
        { 
          error: 'Invalid response from gateway', 
          message: `Gateway returned: ${text.substring(0, 200)}`,
          ok: false 
        },
        { status: response.status || 500 }
      );
    }
    
    // If the gateway returned an error, include it in the response
    if (!response.ok) {
      console.error('Gateway error:', result);
      console.error('Gateway error status:', response.status);
      
      // Distinguish between auth errors and server errors
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Unauthorized', 
            message: result.message || 'Authentication failed. Please log in again.',
            ok: false 
          },
          { status: 401 }
        );
      }
      
      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: result.message || 'Access denied. The service may not be properly configured.',
            ok: false 
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { 
          error: result.error || 'Internal server error', 
          message: result.message || result.error || 'Unknown error from gateway',
          ok: false 
        },
        { status: response.status }
      );
    }
    
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Claude video analysis API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: errorMessage,
        ok: false 
      },
      { status: 500 }
    );
  }
}

