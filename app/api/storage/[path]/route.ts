import { NextRequest, NextResponse } from 'next/server';
import { getStorageServerUrl } from '@/lib/utils/storage-server-url';

/**
 * Next.js API route that proxies GET requests to the Flask storage server
 * Handles requests like /api/storage/user123/video.mp4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path } = await params;
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    // Get storage server URL (prioritizes ngrok URL)
    const storageServerUrl = getStorageServerUrl();
    
    // Proxy request to Flask storage server
    const response = await fetch(`${storageServerUrl}/api/storage/${path}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(
        { error: error.error || error.message || 'File not found' },
        { status: response.status }
      );
    }

    // Get file content and content type
    const fileBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Storage file retrieval proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


