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
    const file = formData.get('video') as File | null;
    const videoUrl = formData.get('videoUrl') as string | null;
    
    // Extract videoPath from videoUrl if provided
    let videoPath: string | null = null;
    if (videoUrl) {
      // Extract path from URL format: /api/storage/videos/user_id/file.mp4 or full URL
      try {
        const urlMatch = videoUrl.match(/\/api\/storage\/(.+)/);
        if (urlMatch) {
          videoPath = urlMatch[1];
        } else {
          // Try parsing as full URL
          const urlObj = new URL(videoUrl);
          const pathMatch = urlObj.pathname.match(/\/api\/storage\/(.+)/);
          if (pathMatch) {
            videoPath = pathMatch[1];
          }
        }
      } catch (e) {
        // If URL parsing fails, try to extract path directly
        const pathMatch = videoUrl.match(/\/api\/storage\/(.+)/);
        if (pathMatch) {
          videoPath = pathMatch[1];
        }
      }
    }
    
    // Require either file upload or videoPath
    if (!file && !videoPath) {
      return NextResponse.json({ 
        error: 'No video provided', 
        message: 'Either upload a video file or provide videoUrl parameter'
      }, { status: 400 });
    }

    // Get configuration parameters with validation
    const rawProcessingMode = (formData.get('processingMode') as string) || 'full';
    const validModes = ['full', 'sampled', 'streaming'];
    const processingMode = validModes.includes(rawProcessingMode) ? rawProcessingMode : 'full';
    
    const rawSampleRate = parseInt((formData.get('sampleRate') as string) || '1', 10);
    const sampleRate = Math.max(1, Math.min(10, rawSampleRate)).toString();
    
    const rawMaxFrames = formData.get('maxFrames') as string;
    const maxFrames = rawMaxFrames ? Math.max(1, Math.min(1000, parseInt(rawMaxFrames, 10))).toString() : undefined;
    
    const enableYOLO = (formData.get('enableYOLO') as string) || 'true';
    
    const rawYoloConfidence = parseFloat((formData.get('yoloConfidence') as string) || '0.5');
    const yoloConfidence = Math.max(0.1, Math.min(1.0, rawYoloConfidence)).toString();
    
    const rawCalibration = formData.get('calibration') as string;
    const calibration = rawCalibration ? Math.max(0.5, Math.min(3.0, parseFloat(rawCalibration))).toString() : undefined;

    // Proxy to main backend gateway
    const gatewayUrl = getBackendUrl();
    const gatewayApiUrl = `${gatewayUrl}/api/pose/analyze-video`;

    // Create new form data for gateway
    const proxyFormData = new FormData();
    
    // If we have videoPath, pass it directly (no file upload needed)
    // Otherwise, upload the file
    if (videoPath) {
      // Pass videoPath for direct file access (more efficient)
      proxyFormData.append('videoUrl', videoUrl!); // videoUrl contains the full path info
    } else if (file) {
      // Upload video file
      proxyFormData.append('video', file);
    }
    
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
      let errorMessage = 'Error processing video';
      let errorDetails: any = {};
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (e) {
        errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      }
      
      // Handle service unavailable (503) errors specifically
      if (response.status === 503) {
        return NextResponse.json(
          { 
            error: 'Service unavailable',
            message: errorMessage || 'Pose detection service is not available',
            hint: errorDetails.hint || 'Please ensure the pose detection service is running',
            ok: false 
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: errorMessage, ok: false, details: errorDetails },
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
            videoUrl || undefined // Use provided videoUrl if available
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
        { 
          error: 'Request timeout',
          message: 'Video analysis took too long. Try with a shorter video or reduce the number of frames.',
          ok: false 
        },
        { status: 408 }
      );
    }
    
    // Handle network/connection errors (503 - Service Unavailable)
    if (error.message?.includes('fetch') || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { 
          error: 'Service unavailable',
          message: 'Unable to connect to the analysis service. Please ensure the backend gateway and pose detection service are running.',
          hint: 'Check if the services are running on the configured ports.',
          ok: false 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error', 
        ok: false,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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

