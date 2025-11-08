import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import type { FileHandle } from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Next.js API route that proxies GET requests to the Flask storage server
 * Handles requests like /api/storage/user123/video.mp4
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: segments } = await ctx.params;
    const rel = Array.isArray(segments) ? segments.join('/') : (segments as unknown as string);
    if (!rel) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

    const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
    const normalized = rel.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    const safeSegments = normalized
      .split('/')
      .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..')
      .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'));
    const resolved = path.resolve(UPLOAD_DIR, ...safeSegments);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    const exists = await fs.access(resolved).then(() => true).catch(() => false);
    if (!exists) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const stat = await fs.stat(resolved);
    const contentType = (() => {
      const ext = path.extname(resolved).toLowerCase().replace('.', '');
      const map: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
        txt: 'text/plain',
      };
      return map[ext] || 'application/octet-stream';
    })();

    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= stat.size) end = stat.size - 1;
        if (end < start) end = start;
        const chunkSize = end - start + 1;
        const fh: FileHandle = await (fs as any).open(resolved, 'r');
        try {
          const buffer = Buffer.allocUnsafe(chunkSize);
          await fh.read(buffer, 0, chunkSize, start);
          return new NextResponse(buffer, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Content-Type': contentType,
            },
          });
        } finally {
          await fh.close();
        }
      }
    }

    const data = await fs.readFile(resolved);
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (e) {
    console.error('Storage file retrieval error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


