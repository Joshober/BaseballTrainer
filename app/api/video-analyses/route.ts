import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getDatabaseAdapter } from '@/lib/database';
import {
  getVideoAnalysisBySessionId,
  getVideoAnalysisByVideoUrl,
  upsertVideoAnalysisPending,
  markVideoAnalysisFailed,
} from '@/lib/mongodb/operations';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeRelativePath(p: string): { relative: string; resolved: string } | null {
  const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
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

// GET: Return stored analysis by sessionId or videoUrl
export async function GET(request: NextRequest) {
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

    const search = request.nextUrl.searchParams;
    const sessionId = search.get('sessionId');
    const videoUrl = search.get('videoUrl');

    // Try sessionId first
    if (sessionId) {
      // First check embedded analysis on the session (only if owner)
      const db = getDatabaseAdapter();
      const session = await db.getSession(sessionId);
      if (session && session.uid !== decoded.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (session?.videoAnalysis?.ok) {
        return NextResponse.json(session.videoAnalysis);
      }
      // Then check separate collection
      const record = await getVideoAnalysisBySessionId(sessionId);
      if (record?.analysis?.ok) {
        return NextResponse.json(record.analysis);
      }
      // Not found yet — treat as pending to avoid noisy 404s
      return NextResponse.json({ ok: false, pending: true }, { status: 200 });
    }

    if (videoUrl) {
      const record = await getVideoAnalysisByVideoUrl(videoUrl);
      if (record?.analysis?.ok) {
        return NextResponse.json(record.analysis);
      }
      // Not found yet — treat as pending to avoid noisy 404s
      return NextResponse.json({ ok: false, pending: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Missing sessionId or videoUrl' }, { status: 400 });
  } catch (error) {
    console.error('Video analyses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Trigger background analysis for a stored video
// Body: { sessionId?: string, videoUrl?: string, videoPath?: string }
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
    const sessionId: string | undefined = body.sessionId || undefined;
    let videoPath: string | undefined = body.videoPath || undefined;
    const videoUrl: string | undefined = body.videoUrl || undefined;

    // Derive videoPath from videoUrl if needed
    if (!videoPath && videoUrl) {
      const m = videoUrl.match(/\/api\/storage\/(.+)$/);
      if (m) videoPath = m[1];
    }

    if (!videoPath) {
      return NextResponse.json({ error: 'Missing videoPath or videoUrl' }, { status: 400 });
    }

    const safe = sanitizeRelativePath(videoPath);
    if (!safe) {
      return NextResponse.json({ error: 'Invalid video path' }, { status: 400 });
    }

    // Mark as pending/in-progress in DB
    try {
      await upsertVideoAnalysisPending(decoded.sub, sessionId, videoUrl);
    } catch (e) {
      // non-fatal
    }

    // Read file from local uploads
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(safe.resolved);
    } catch (e) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    // Kick off background analysis via our own Next API route
    // This route will proxy to the gateway and save to MongoDB
    const origin = request.nextUrl.origin;
    const run = async () => {
      try {
        const fd = new FormData();
        const filename = path.basename(safe.resolved);
        // Guess content-type from extension
        const ext = path.extname(filename).toLowerCase();
        const mime = ext === '.webm' ? 'video/webm' : 'video/mp4';
        fd.append('video', new Blob([fileBuffer], { type: mime }), filename);
        if (videoUrl) fd.append('videoUrl', videoUrl);
        if (sessionId) fd.append('sessionId', sessionId);

        await fetch(`${origin}/api/pose/analyze-video`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
          // Let it run; no timeout from here
        });
      } catch (e) {
        console.error('Background analysis failed:', e);
        try {
          await markVideoAnalysisFailed(sessionId, videoUrl, (e as Error)?.message || 'analysis failed');
        } catch {}
      }
    };

    // Fire and forget
    setTimeout(run, 10);

    return NextResponse.json({ started: true, sessionId, videoUrl: videoUrl || `/api/storage/${safe.relative}` }, { status: 202 });
  } catch (error) {
    console.error('Video analyses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
