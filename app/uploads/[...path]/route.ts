import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Serve video files directly from local uploads directory
 * Route: /uploads/videos/{uid}/{filename}
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await ctx.params;
    const filePath = Array.isArray(segments) ? segments.join('/') : (segments as unknown as string);
    
    if (!filePath) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
    }

    // Security: prevent directory traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(UPLOAD_DIR, filePath);
    
    // Ensure the resolved path is within uploads directory
    if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file stats
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    // Determine content type
    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const contentTypeMap: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Read and serve the file
    const fileBuffer = await fs.readFile(resolvedPath);
    
    // Handle range requests for video streaming
    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = parseInt(match[1] || '0');
        const end = match[2] ? parseInt(match[2]) : fileBuffer.length - 1;
        const chunk = fileBuffer.slice(start, end + 1);
        
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${start}-${end}/${fileBuffer.length}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Uploads Route] Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}

