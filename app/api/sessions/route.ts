import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/auth0/admin';
import type { CreateSessionInput } from '@/types/session';

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

    const body: CreateSessionInput = await request.json();
    
    // Verify user owns this session
    // Auth0 uses 'sub' as the user ID
    if (body.uid !== decodedToken.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDatabaseAdapter();
    const session = await db.createSession(body);

    // Kick off background AI analysis if this session has a video
    try {
      if (session.videoPath || session.videoURL) {
        // Build absolute URL for internal call
        const url = new URL('/api/video-analyses', request.url);
        // Fire and forget; do not await
        fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: session.id,
            videoPath: session.videoPath || undefined,
            videoUrl: session.videoURL || undefined,
          }),
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Session creation error:', error);
    const errorMessage = error?.message || 'Internal server error';
    const errorDetails = error?.stack || '';
    console.error('Error details:', errorDetails);
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    // Auth0 uses 'sub' as the user ID
    const uid = searchParams.get('uid') || decodedToken.sub;
    const teamId = searchParams.get('teamId');

    const db = getDatabaseAdapter();
    let sessions;
    if (teamId) {
      sessions = await db.getSessionsByTeam(teamId);
    } else {
      sessions = await db.getSessionsByUser(uid);
    }
    
    return NextResponse.json(sessions, {
      headers: {
        // Modest private cache to speed up rapid reloads while keeping user-specific
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


