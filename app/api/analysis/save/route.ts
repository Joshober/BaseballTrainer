import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { saveVideoAnalysis, updateSessionVideoAnalysis, updateSessionRecommendations } from '@/lib/mongodb/operations';
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

    const body = await request.json();
    const { sessionId, videoUrl, analysis, videoFileName } = body || {};
    if (!analysis || (typeof analysis !== 'object')) {
      return NextResponse.json({ error: 'Missing analysis' }, { status: 400 });
    }
    // Save
    const analysisId = await saveVideoAnalysis(
      decoded.sub,
      analysis,
      videoFileName,
      videoUrl,
      sessionId
    );
    if (sessionId) {
      try {
        await updateSessionVideoAnalysis(sessionId, analysis);
      } catch {}
    }

    // Optional: trigger drill recommendations and save on the session
    try {
      const recUrl = config.drillRecommender.url || 'http://localhost:5001';
      const recResp = await fetch(`${recUrl}/api/drills/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });
      if (recResp.ok) {
        const recs = await recResp.json();
        if (sessionId) {
          await updateSessionRecommendations(sessionId, recs);
        }
      }
    } catch (e) {
      // non-fatal
    }

    // Revalidate videos page to refresh cards
    try { revalidatePath('/videos'); } catch {}
    return NextResponse.json({ ok: true, analysisId });
  } catch (e: any) {
    console.error('Analysis save error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
