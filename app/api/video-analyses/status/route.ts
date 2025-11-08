import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getVideoAnalysisBySessionIds } from '@/lib/mongodb/operations';

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

    const map = await getVideoAnalysisBySessionIds(sessionIds);

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
  } catch (error) {
    console.error('Video analyses status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
