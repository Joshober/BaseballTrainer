import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function sanitizeAndResolve(p: string): { relative: string; resolved: string } | null {
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  
  // More permissive sanitization - only remove truly dangerous characters
  // Allow alphanumeric, dots, dashes, underscores, and common path characters
  const safeSegments = normalized
    .split('/')
    .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..')
    .map((seg) => {
      // Only replace characters that are truly problematic, keep UUIDs and common IDs intact
      // Allow: a-z, A-Z, 0-9, ., -, _, and @ (for email-like IDs)
      return seg.replace(/[^a-zA-Z0-9.@_-]/g, '_');
    });
  
  if (safeSegments.length === 0) return null;
  const relative = safeSegments.join('/');
  const resolved = path.resolve(UPLOAD_DIR, ...safeSegments);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return null;
  return { relative, resolved };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const relPath = String(form.get('path') || '');
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!relPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    const safe = sanitizeAndResolve(relPath);
    if (!safe) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    const data = Buffer.from(await (file as Blob).arrayBuffer());
    await fs.mkdir(path.dirname(safe.resolved), { recursive: true });
    await fs.writeFile(safe.resolved, data);
    const stat = await fs.stat(safe.resolved);
    return NextResponse.json({ url: `/api/storage/${safe.relative}`, path: safe.relative, size: stat.size });
  } catch (e) {
    console.error('Storage upload error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const relPath = request.nextUrl.searchParams.get('path');
    console.log('[Storage API] GET request for path:', relPath);
    
    if (!relPath) {
      console.error('[Storage API] Missing path parameter');
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }
    
    const safe = sanitizeAndResolve(relPath);
    if (!safe) {
      console.error('[Storage API] Invalid path after sanitization:', relPath);
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    
    console.log('[Storage API] Resolved path:', safe.resolved);
    
    const exists = await fs.access(safe.resolved).then(() => true).catch(() => false);
    if (!exists) {
      console.error('[Storage API] File not found at:', safe.resolved);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const stat = await fs.stat(safe.resolved);
    console.log('[Storage API] File found, size:', stat.size, 'bytes');
    
    const data = await fs.readFile(safe.resolved);
    const contentType = getContentType(safe.resolved);
    console.log('[Storage API] Returning file with content-type:', contentType);
    
    return new NextResponse(data, { 
      headers: { 
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
      } 
    });
  } catch (e) {
    console.error('[Storage API] Error retrieving file:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const relPath = request.nextUrl.searchParams.get('path');
    if (!relPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    const safe = sanitizeAndResolve(relPath);
    if (!safe) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    const exists = await fs.access(safe.resolved).then(() => true).catch(() => false);
    if (!exists) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    await fs.unlink(safe.resolved);
    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (e) {
    console.error('Storage delete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


