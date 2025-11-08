import { NextRequest, NextResponse } from 'next/server';
import { getStorageServerUrl } from '@/lib/utils/storage-server-url';

/**
 * Next.js API route that proxies requests to the Flask storage server
 * All storage operations are routed through the storage server via ngrok URL
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth header to forward to storage server
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get storage server URL (prioritizes ngrok URL)
    const storageServerUrl = getStorageServerUrl();
    console.log('[Storage API] Using storage server URL:', storageServerUrl);
    
    // Get form data from request
    const formData = await request.formData();
    
    // Proxy request to Flask storage server
    const response = await fetch(`${storageServerUrl}/api/storage/upload`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(
        { error: error.error || error.message || 'Upload failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Storage upload proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get file path from query params
    const path = request.nextUrl.searchParams.get('path');
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

export async function DELETE(request: NextRequest) {
  try {
    // Get auth header to forward to storage server
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get file path from query params
    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    // Get storage server URL (prioritizes ngrok URL)
    const storageServerUrl = getStorageServerUrl();
    
    // Proxy request to Flask storage server
    const response = await fetch(`${storageServerUrl}/api/storage?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(
        { error: error.error || error.message || 'Delete failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Storage delete proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


