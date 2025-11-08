import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs, open as fsOpen } from 'fs';
import { promisify } from 'util';
import type { FileHandle } from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function sanitizeAndResolve(p: string): { relative: string; resolved: string } | null {
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const safeSegments = normalized
    .split('/')
    .filter(seg => seg.length > 0 && seg !== '.' && seg !== '..')
    .map(seg => seg.replace(/[^a-zA-Z0-9._-]/g, '_'));
  if (safeSegments.length === 0) return null;
  const relative = safeSegments.join('/');
  const resolved = path.resolve(UPLOAD_DIR, ...safeSegments);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return null;
  return { relative, resolved };
}

/**
 * Next.js API route that proxies GET requests to the Flask storage server
 * Handles requests like /api/storage/user123/video.mp4
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: segments } = await ctx.params;
    const rel = Array.isArray(segments) ? segments.join('/') : (segments as unknown as string);
    if (!rel) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }
    const safe = sanitizeAndResolve(rel);
    if (!safe) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    const exists = await fs
      .access(safe.resolved)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const stat = await fs.stat(safe.resolved);
    const contentType = getContentType(safe.resolved);
    const range = request.headers.get('range');
    if (range) {
      // Parse Range: bytes=start-end
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= stat.size) end = stat.size - 1;
        if (end < start) end = start;
        const chunkSize = end - start + 1;

        // Read only the requested chunk
        const fh: FileHandle = await (fs as any).open(safe.resolved, 'r');
        try {
          const buffer = Buffer.allocUnsafe(chunkSize);
          await fh.read(buffer, 0, chunkSize, start);
          const headers: Record<string, string> = {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
          };
          return new NextResponse(buffer, { status: 206, headers });
        } finally {
          await fh.close();
        }
      }
    }
    // No Range header: send whole file
    const data = await fs.readFile(safe.resolved);
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Storage file retrieval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


