import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const { path } = await params;
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    const fullPath = join(process.cwd(), 'server', 'uploads', path);
    const file = await readFile(fullPath);
    
    // Determine content type
    const ext = path.split('.').pop()?.toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                        ext === 'png' ? 'image/png' :
                        ext === 'mp4' ? 'video/mp4' : 'application/octet-stream';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('File read error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}


