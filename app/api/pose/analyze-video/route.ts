import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/utils/backend-url';
import { verifyIdToken } from '@/lib/auth0/admin';
import { saveVideoAnalysis } from '@/lib/mongodb/operations';

/**
 * Next.js API route for video analysis
 * This route proxies requests to the main backend gateway
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get video file from form data
    const formData = await request.formData();
    const file = formData.get('video') as File;
    if (!file) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    // Get configuration parameters
    const processingMode = formData.get('processingMode') as string || 'full';
    const sampleRate = formData.get('sampleRate') as string || '1';
    const maxFrames = formData.get('maxFrames') as string;
    const enableYOLO = formData.get('enableYOLO') as string || 'true';
    const yoloConfidence = formData.get('yoloConfidence') as string || '0.5';
    const calibration = formData.get('calibration') as string;

    // Proxy to main backend gateway
    const gatewayUrl = getBackendUrl();
    const gatewayApiUrl = `${gatewayUrl}/api/pose/analyze-video`;

    // Create new form data for gateway
    const proxyFormData = new FormData();
    proxyFormData.append('video', file);
    proxyFormData.append('processingMode', processingMode);
    proxyFormData.append('sampleRate', sampleRate);
    if (maxFrames) {
      proxyFormData.append('maxFrames', maxFrames);
    }
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
      // Increase timeout for video processing (10 minutes for long videos)
      signal: AbortSignal.timeout(600000), // 10 minutes
    });

    if (!response.ok) {
      let errorMessage = 'Error al procesar el video';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      }
      return NextResponse.json(
        { error: errorMessage, ok: false },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Save to MongoDB if analysis was successful
    if (result.ok) {
      try {
        const token = authHeader.substring(7);
        const decodedToken = await verifyIdToken(token);
        if (decodedToken) {
          const userId = decodedToken.sub;
          const analysisId = await saveVideoAnalysis(
            userId,
            result,
            file.name,
            undefined // videoUrl can be added later if video is uploaded to storage
          );
          // Add analysis ID to response
          result.analysisId = analysisId;
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error('Error saving video analysis to MongoDB:', error);
      }
    }
    
    // Filter out null/undefined values before returning
    const cleanedResult = removeNullValues(result);
    
    return NextResponse.json(cleanedResult, { status: response.status });
  } catch (error: any) {
    console.error('Video analysis API error:', error);
    
    // Handle timeout
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'El análisis del video tomó demasiado tiempo. Intenta con un video más corto o reduce el número de frames.', ok: false },
        { status: 408 }
      );
    }
    
    // Handle network errors
    if (error.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'No se pudo conectar al servicio de análisis. Verifica que el backend esté corriendo.', ok: false },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error', ok: false },
      { status: 500 }
    );
  }
}

/**
 * Recursively remove null and undefined values from an object
 */
function removeNullValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }
  
  if (Array.isArray(obj)) {
    const filtered = obj.map(item => removeNullValues(item)).filter(item => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = removeNullValues(value);
      if (cleanedValue !== undefined && cleanedValue !== null) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  
  return obj;
}

