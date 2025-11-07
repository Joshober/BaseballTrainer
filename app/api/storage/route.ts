import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { verifyIdToken } from '@/lib/firebase/admin';

const UPLOAD_DIR = join(process.cwd(), 'server', 'uploads');

export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file || !path) {
      return NextResponse.json({ error: 'Missing file or path' }, { status: 400 });
    }

    // Create directory structure
    const fullPath = join(UPLOAD_DIR, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(fullPath, buffer);

    // Return URL
    const url = `/api/storage/${path}`;
    return NextResponse.json({ url, path });
  } catch (error) {
    console.error('Storage upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
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

