import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/utils/backend-url';

/**
 * Next.js API route for live video stream analysis
 * This route proxies requests to the main backend gateway
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get video stream from form data
    const formData = await request.formData();
    const file = formData.get('video') as File;
    if (!file) {
      return NextResponse.json({ error: 'No video stream provided' }, { status: 400 });
    }

    // Get configuration parameters
    const sampleRate = formData.get('sampleRate') as string || '1';
    const maxFrames = formData.get('maxFrames') as string || '30';
    const enableYOLO = formData.get('enableYOLO') as string || 'true';
    const yoloConfidence = formData.get('yoloConfidence') as string || '0.5';
    const calibration = formData.get('calibration') as string;

    // Proxy to main backend gateway
    const gatewayUrl = getBackendUrl();
    const gatewayApiUrl = `${gatewayUrl}/api/pose/analyze-live`;

    // Create new form data for gateway
    const proxyFormData = new FormData();
    proxyFormData.append('video', file);
    proxyFormData.append('sampleRate', sampleRate);
    proxyFormData.append('maxFrames', maxFrames);
    proxyFormData.append('enableYOLO', enableYOLO);
    proxyFormData.append('yoloConfidence', yoloConfidence);
    if (calibration) {
      proxyFormData.append('calibration', calibration);
    }

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
    console.error('Live stream analysis API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500 }
    );
  }
}

