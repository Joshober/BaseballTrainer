import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/utils/backend-url';

/**
 * Next.js API route for pose detection
 * This route proxies requests to the main backend gateway
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get image file from form data
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Proxy to main backend gateway
    const gatewayUrl = getBackendUrl();
    const gatewayApiUrl = `${gatewayUrl}/api/pose/detect`;

    // Create new form data for gateway
    const proxyFormData = new FormData();
    proxyFormData.append('image', file);

    // Forward request to gateway (which will route to Python backend)
    const response = await fetch(gatewayApiUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: proxyFormData,
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Pose detection API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500 }
    );
  }
}


