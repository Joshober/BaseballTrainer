import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getSession } from '@/lib/mongodb/operations';
import { getBackendUrl } from '@/lib/utils/backend-url';
import { config } from '@/lib/utils/config';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Next.js API route for OpenRouter video analysis
 * Extracts frames from video and sends to OpenRouter for coaching feedback
 */
export async function POST(request: NextRequest) {
  try {
    console.log('OpenRouter analyze-video endpoint called');
    
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('OpenRouter: Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let token = authHeader.substring(7).trim();
    
    // Log token info for debugging (without exposing the full token)
    console.log('OpenRouter: Token received', {
      length: token.length,
      startsWith: token.substring(0, 20),
      parts: token.split('.').length,
      hasSpaces: token.includes(' '),
    });
    
    // Validate token format before attempting verification
    if (!token || token.length < 10) {
      console.error('OpenRouter: Token is empty or too short');
      return NextResponse.json({ error: 'Invalid token: token is empty or too short' }, { status: 401 });
    }
    
    // Check if token looks like a JWT (should have 3 or 5 parts separated by dots)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3 && tokenParts.length !== 5) {
      console.error('OpenRouter: Token does not have valid JWT/JWE format', {
        parts: tokenParts.length,
        tokenPreview: token.substring(0, 50) + '...',
      });
      return NextResponse.json({ 
        error: `Invalid token format: expected JWT (3 parts) or JWE (5 parts), got ${tokenParts.length} parts` 
      }, { status: 401 });
    }
    
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
      if (!decodedToken) {
        console.error('OpenRouter: Token verification returned null');
        return NextResponse.json({ error: 'Invalid token: verification returned null' }, { status: 401 });
      }
      console.log('OpenRouter: Token verified successfully', { sub: decodedToken.sub });
    } catch (tokenError: any) {
      console.error('OpenRouter: Token verification error:', {
        message: tokenError.message,
        stack: tokenError.stack,
      });
      return NextResponse.json({ 
        error: `Token verification failed: ${tokenError.message}` 
      }, { status: 401 });
    }

    // Get session ID from request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('OpenRouter: Failed to parse request body:', parseError.message);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const sessionId = body.sessionId;
    console.log('OpenRouter: Session ID:', sessionId);
    
    if (!sessionId) {
      console.error('OpenRouter: Session ID is missing');
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get session from database
    let session;
    try {
      session = await getSession(sessionId);
      if (!session) {
        console.error('OpenRouter: Session not found:', sessionId);
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      console.log('OpenRouter: Session found:', { id: session.id, videoPath: session.videoPath });
    } catch (sessionError: any) {
      console.error('OpenRouter: Error getting session:', sessionError.message);
      return NextResponse.json({ error: `Failed to get session: ${sessionError.message}` }, { status: 500 });
    }

    // Verify user owns this session
    if (session.uid !== decodedToken.sub) {
      console.error('OpenRouter: User does not own session:', { sessionUid: session.uid, tokenSub: decodedToken.sub });
      return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
    }

    // Check if session has a video
    if (!session.videoPath) {
      console.error('OpenRouter: Session does not have a video path');
      return NextResponse.json({ error: 'Session does not have a video' }, { status: 400 });
    }

    // Read video file directly from filesystem (same approach as /api/storage route)
    // Use the exact same sanitization logic as the storage route
    const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
    
    function sanitizeAndResolve(p: string): { relative: string; resolved: string } | null {
      const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
      if (normalized.includes('..')) return null;
      // Same sanitization as storage route: replace special chars with _ (except . _ -)
      const safeSegments = normalized
        .split('/')
        .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..')
        .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'));
      if (safeSegments.length === 0) return null;
      const relative = safeSegments.join('/');
      const resolved = path.resolve(UPLOAD_DIR, ...safeSegments);
      if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return null;
      return { relative, resolved };
    }
    
    // Sanitize and resolve the path (this will convert | to _ like the storage route does)
    const safe = sanitizeAndResolve(session.videoPath);
    if (!safe) {
      return NextResponse.json({ error: 'Invalid video path' }, { status: 400 });
    }
    
    // Check if file exists
    try {
      await fs.access(safe.resolved);
    } catch (error) {
      console.error('Video file not found:', { 
        videoPath: session.videoPath, 
        sanitizedPath: safe.relative,
        resolved: safe.resolved,
        uploadsDir: UPLOAD_DIR 
      });
      return NextResponse.json({ 
        error: `Video file not found at path: ${session.videoPath} (resolved: ${safe.resolved})` 
      }, { status: 404 });
    }
    
    // Read video file
    let videoBuffer: Buffer;
    try {
      videoBuffer = await fs.readFile(safe.resolved);
      console.log('Successfully read video file:', { 
        originalPath: session.videoPath, 
        sanitizedPath: safe.relative,
        resolved: safe.resolved, 
        size: videoBuffer.length 
      });
    } catch (error: any) {
      console.error('Failed to read video file:', error);
      return NextResponse.json(
        { error: `Failed to read video file: ${error.message}` },
        { status: 500 }
      );
    }

    // Extract frames using pose-detection-service via gateway
    // Create a File object from the buffer (Node.js 18+ supports File API)
    const gatewayUrl = getBackendUrl();
    const extractFramesUrl = `${gatewayUrl}/api/pose/extract-frames`;

    // Create a File object from the buffer (same approach as other Next.js API routes)
    // Convert Buffer to Uint8Array for File constructor compatibility
    const videoFile = new File([new Uint8Array(videoBuffer)], 'video.mp4', { type: 'video/mp4' });

    // Create FormData using native FormData API (works with fetch in Node.js 18+)
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('frameInterval', '5'); // Every 5th frame

    // Send request to gateway using fetch (same as other Next.js API routes)
    let framesData;
    try {
      const framesResponse = await fetch(extractFramesUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          // Don't set Content-Type - fetch will set it automatically with boundary for FormData
        },
        body: formData,
      });

      if (!framesResponse.ok) {
        const errorText = await framesResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Frame extraction failed' };
        }
        console.error('Frame extraction failed:', {
          status: framesResponse.status,
          statusText: framesResponse.statusText,
          error: errorData,
        });
        return NextResponse.json(
          { error: errorData.error || errorData.message || 'Failed to extract frames' },
          { status: framesResponse.status }
        );
      }

      framesData = await framesResponse.json();
    } catch (error: any) {
      console.error('Frame extraction request error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to extract frames' },
        { status: 500 }
      );
    }

    if (!framesData.ok || !framesData.frames || framesData.frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames extracted from video' },
        { status: 400 }
      );
    }

    // Prepare frames for OpenRouter (extract base64 data from data URLs)
    const defaultMaxFrames = 10;
    const maxFramesConfig = Number.isFinite(config.openRouter.maxFrames)
      ? Math.max(1, config.openRouter.maxFrames)
      : defaultMaxFrames;
    const maxFramesForOpenRouter =
      typeof process.env.OPENROUTER_MAX_FRAMES === 'string'
        ? Math.max(
            1,
            Number.parseInt(process.env.OPENROUTER_MAX_FRAMES, 10) || maxFramesConfig
          )
        : maxFramesConfig;
    const framesToSend = framesData.frames.slice(0, maxFramesForOpenRouter);
    
    console.log('OpenRouter: Preparing frames', {
      totalFrames: framesData.frames.length,
      framesToSend: framesToSend.length,
      maxFramesConfigured: maxFramesForOpenRouter,
    });
    
    const frames = framesToSend.map((frame: any) => {
      // Remove data URL prefix if present
      const base64Data = frame.image.replace(/^data:image\/jpeg;base64,/, '');
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
        },
      };
    });
    
    if (frames.length === 0) {
      console.error('OpenRouter: No frames to send');
      return NextResponse.json(
        { error: 'No frames to send to OpenRouter' },
        { status: 400 }
      );
    }

    // Check if OpenRouter API key is configured
    if (!config.openRouter.apiKey) {
      console.error('OpenRouter: API key not configured');
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    console.log('OpenRouter: Sending request to OpenRouter API', {
      framesCount: frames.length,
      model: config.openRouter.model,
      apiKeyLength: config.openRouter.apiKey.length,
      apiKeyPrefix: config.openRouter.apiKey.substring(0, 10) + '...',
    });

    // Send to OpenRouter API
    let openRouterResponse;
    try {
      openRouterResponse = await fetch(config.openRouter.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openRouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Baseball Trainer',
        },
        body: JSON.stringify({
          model: config.openRouter.model, // Vision-capable model
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
    } catch (fetchError: any) {
      console.error('OpenRouter: Fetch error:', {
        message: fetchError.message,
        stack: fetchError.stack,
      });
      return NextResponse.json(
        { error: `Failed to connect to OpenRouter API: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text().catch(() => '');
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'OpenRouter API error' };
      }
      
      console.error('OpenRouter API error:', {
        status: openRouterResponse.status,
        statusText: openRouterResponse.statusText,
        error: errorData,
        errorText: errorText.substring(0, 500), // First 500 chars
      });
      
      // Extract error message from various possible formats
      const errorMessage = 
        errorData.error?.message || 
        errorData.message || 
        errorData.error || 
        errorData.detail ||
        errorText ||
        `OpenRouter API error (${openRouterResponse.status})`;
      
      return NextResponse.json(
        { 
          error: errorMessage,
          status: openRouterResponse.status,
          details: process.env.NODE_ENV === 'development' ? errorData : undefined
        },
        { status: openRouterResponse.status }
      );
    }

    let openRouterData;
    try {
      openRouterData = await openRouterResponse.json();
      console.log('OpenRouter: Response received', {
        hasChoices: !!openRouterData.choices,
        choicesCount: openRouterData.choices?.length || 0,
      });
    } catch (parseError: any) {
      console.error('OpenRouter: Failed to parse response:', parseError.message);
      return NextResponse.json(
        { error: 'Failed to parse OpenRouter response' },
        { status: 500 }
      );
    }
    
    // Extract coaching feedback from response (normalize into plain text)
    const feedback = extractFeedback(openRouterData) || 'No feedback available';
    
    console.log('OpenRouter: Feedback extracted', {
      feedbackLength: feedback.length,
      feedbackPreview: feedback.substring(0, 100) + '...',
    });
    
    return NextResponse.json({
      ok: true,
      feedback,
      framesAnalyzed: framesToSend.length,
      totalFrames: framesData.extractedFrames,
    });
  } catch (error: any) {
    console.error('OpenRouter video analysis error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error', 
        ok: false,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

function extractFeedback(openRouterData: any): string | null {
  const choice = openRouterData?.choices?.[0];
  if (!choice || !choice.message) return null;
  
  const content = choice.message.content;
  
  if (typeof content === 'string') {
    return content.trim() || null;
  }
  
  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        if (part.type === 'text' && typeof part.text === 'string') return part.text;
        return '';
      })
      .map((text) => text.trim())
      .filter(Boolean);
    
    if (textParts.length > 0) {
      return textParts.join('\n\n');
    }
  }
  
  return null;
}
