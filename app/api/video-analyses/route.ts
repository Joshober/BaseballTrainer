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

    // Mark as pending/in-progress in DB (best-effort)
    try { await upsertVideoAnalysisPending(decoded.sub, sessionId, videoUrl); } catch {}

    // Read file from local uploads and forward to gateway/pose analysis API
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(safe.resolved);
    } catch {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    const origin = request.nextUrl.origin;
    try {
      const fd = new FormData();
      const filename = path.basename(safe.resolved);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.webm' ? 'video/webm' : 'video/mp4';
      fd.append('video', new Blob([fileBuffer], { type: mime }), filename);
      if (videoUrl) fd.append('videoUrl', videoUrl);
      if (sessionId) fd.append('sessionId', sessionId);

      const resp = await fetch(`${origin}/api/pose/analyze-video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || err.message || 'Analysis failed');
      }
      return NextResponse.json({ started: true, sessionId, videoUrl: videoUrl || `/api/storage/${safe.relative}` }, { status: 202 });
    } catch (e: any) {
      console.error('Background analysis failed:', e);
      try { await markVideoAnalysisFailed(sessionId, videoUrl, e.message || 'analysis failed'); } catch {}
      return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 });
    }
  } catch (error) {
    console.error('Video analyses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
