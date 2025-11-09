import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getVideoAnalysisBySessionIds } from '@/lib/mongodb/operations';
import { getDatabaseAdapter } from '@/lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await verifyIdToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const sessionIds: string[] = Array.isArray(body.sessionIds) ? body.sessionIds : [];
    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'Missing sessionIds' }, { status: 400 });
    }

    let map: Record<string, any> = {};
    try {
      map = await getVideoAnalysisBySessionIds(sessionIds);
    } catch (error: any) {
      console.warn('Error getting video analysis by session IDs:', error?.message);
      // Continue with empty map
    }

    // Fallback: if no record yet, but the session embeds analysis, treat as completed
    try {
      const db = getDatabaseAdapter();
      await Promise.all(sessionIds.map(async (sid) => {
        if (!map[sid]) {
          try {
            const session = await db.getSession(sid);
            if (session?.videoAnalysis?.ok) {
              map[sid] = {
                id: `session-${sid}`,
                sessionId: sid,
                status: 'completed',
                analysis: session.videoAnalysis,
                createdAt: session.createdAt || new Date(),
                updatedAt: new Date(),
              } as any;
            }
          } catch (err) {
            // Skip if session doesn't exist
          }
        }
      }));
    } catch (error: any) {
      console.warn('Error checking sessions for embedded analysis:', error?.message);
    }

    // Retrigger analysis in backend for pending/failed sessions (with backoff)
    const origin = request.nextUrl.origin;
    const now = Date.now();
    const RETRIGGER_MS = 30_000; // 30s debounce between attempts

    await Promise.all(Object.entries(map).map(async ([sessionId, rec]) => {
      try {
        // If no record or not completed, and lastAttemptAt is old or missing, attempt retrigger
        const status = (rec as any)?.status as string | undefined;
        const lastAttemptAt = (rec as any)?.lastAttemptAt ? new Date((rec as any).lastAttemptAt).getTime() : 0;
        const shouldRetrigger = (!rec || status !== 'completed') && (now - lastAttemptAt > RETRIGGER_MS);
        if (!shouldRetrigger) return;

        // Fetch session to get videoUrl
        const sessResp = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${authHeader}` },
        });
        if (!sessResp.ok) return;
        const sess = await sessResp.json();
        if (!sess?.videoURL) return;

        // Fire-and-forget retrigger
        fetch(`${origin}/api/video-analyses`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, videoUrl: sess.videoURL }),
        }).catch(() => {});
      } catch {}
    }));

    return NextResponse.json({ ok: true, map });
  } catch (error: any) {
    console.error('Video analyses status error:', error);
    // Return empty map instead of 500 error if database is not available
    if (error?.message?.includes('Database') || error?.message?.includes('MongoDB')) {
      console.warn('Database not available, returning empty map');
      return NextResponse.json({ ok: true, map: {} });
    }
    return NextResponse.json({ error: 'Internal server error', message: error?.message || 'Unknown error' }, { status: 500 });
  }
}
