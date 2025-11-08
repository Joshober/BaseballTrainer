import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getSession } from '@/lib/mongodb/operations';
import { getStorageServerUrl } from '@/lib/utils/storage-server-url';
import { getBackendUrl } from '@/lib/utils/backend-url';
import { config } from '@/lib/utils/config';

/**
 * Next.js API route for OpenRouter video analysis
 * Extracts frames from video and sends to OpenRouter for coaching feedback
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get session ID from request body
    const body = await request.json();
    const sessionId = body.sessionId;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get session from database
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify user owns this session
    if (session.uid !== decodedToken.sub) {
      return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
    }

    // Check if session has a video
    if (!session.videoPath) {
      return NextResponse.json({ error: 'Session does not have a video' }, { status: 400 });
    }

    // Download video from storage server
    const storageServerUrl = getStorageServerUrl();
    const videoUrl = `${storageServerUrl}/api/storage/${session.videoPath}`;
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download video from storage' },
        { status: 500 }
      );
    }

    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);

    // Extract frames using pose-detection-service
    const gatewayUrl = getBackendUrl();
    const extractFramesUrl = `${gatewayUrl}/api/pose/extract-frames`;

    // Create FormData for video upload
    const formData = new FormData();
    // In Node.js, we need to create a Blob-like object
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('video', videoBlob, 'video.mp4');
    formData.append('frameInterval', '5'); // Every 5th frame

    const framesResponse = await fetch(extractFramesUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: formData,
    });

    if (!framesResponse.ok) {
      const errorData = await framesResponse.json().catch(() => ({ error: 'Frame extraction failed' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to extract frames' },
        { status: framesResponse.status }
      );
    }

    const framesData = await framesResponse.json();
    if (!framesData.ok || !framesData.frames || framesData.frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames extracted from video' },
        { status: 400 }
      );
    }

    // Prepare frames for OpenRouter (extract base64 data from data URLs)
    const frames = framesData.frames.map((frame: any) => {
      // Remove data URL prefix if present
      const base64Data = frame.image.replace(/^data:image\/jpeg;base64,/, '');
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
        },
      };
    });

    // Check if OpenRouter API key is configured
    if (!config.openRouter.apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // Send to OpenRouter API
    const openRouterResponse = await fetch(config.openRouter.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openRouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Baseball Trainer',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o', // Vision-capable model
        messages: [
          {
            role: 'system',
            content: 'You are a baseball coach. Analyze these frames from a baseball swing video and provide a short, actionable coaching blurb (2-3 sentences). Focus on form, technique, and improvement areas.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this baseball swing and provide coaching feedback.',
              },
              ...frames,
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({ error: 'OpenRouter API error' }));
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to get feedback from OpenRouter' },
        { status: openRouterResponse.status }
      );
    }

    const openRouterData = await openRouterResponse.json();
    
    // Extract coaching feedback from response
    const feedback = openRouterData.choices?.[0]?.message?.content || 'No feedback available';
    
    return NextResponse.json({
      ok: true,
      feedback,
      framesAnalyzed: framesData.extractedFrames,
    });
  } catch (error: any) {
    console.error('OpenRouter video analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', ok: false },
      { status: 500 }
    );
  }
}

