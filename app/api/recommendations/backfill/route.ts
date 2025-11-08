import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getSessionsMissingRecommendations, getVideoAnalysisBySessionId, updateSessionRecommendations } from '@/lib/mongodb/operations';
import { getDatabaseAdapter } from '@/lib/database';
import { revalidatePath } from 'next/cache';
import { config } from '@/lib/utils/config';

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
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10))) : 50;

    const pending = await getSessionsMissingRecommendations(limit);
    const recUrl = config.drillRecommender.url || 'http://localhost:5001';
    let processed = 0;
    for (const s of pending) {
      try {
        // Get analysis from session or collection
        const db = getDatabaseAdapter();
        const session = await db.getSession(s.id);
        const analysis = session?.videoAnalysis?.ok ? session.videoAnalysis : (await getVideoAnalysisBySessionId(s.id))?.analysis;
        if (!analysis?.ok) continue;
        const resp = await fetch(`${recUrl}/api/drills/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis }),
        });
        if (!resp.ok) continue;
        const recs = await resp.json();
        await updateSessionRecommendations(s.id, recs);
        processed += 1;
      } catch {}
    }

    try { revalidatePath('/videos'); } catch {}
    return NextResponse.json({ ok: true, processed, total: pending.length });
  } catch (e: any) {
    console.error('Recommendations backfill error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

