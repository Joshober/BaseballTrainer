import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBackendUrl } from '@/lib/utils/backend-url';
import { config } from '@/lib/utils/config';
import { verifyIdToken } from '@/lib/auth0/admin';
import { saveVideoAnalysis, updateSessionVideoAnalysis, updateSessionRecommendations } from '@/lib/mongodb/operations';
import { getOpenRouterFeedback } from '@/lib/utils/openrouter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    
    // Read file into buffer so we can reuse it for OpenRouter
    const fileBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([fileBuffer], { type: file.type });
    const reusableFile = new File([fileBlob], file.name, { type: file.type });
    
    // Get videoUrl if provided (for videos from existing sessions)
    const videoUrl = formData.get('videoUrl') as string | null;
    const sessionId = formData.get('sessionId') as string | null;

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
    proxyFormData.append('video', reusableFile);
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
    if (videoUrl) {
      proxyFormData.append('videoUrl', videoUrl);
    }
    if (sessionId) {
      proxyFormData.append('sessionId', sessionId);
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
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      }
      
      // Provide helpful error message if gateway is not running
      if (response.status === 404) {
        errorMessage = 'Backend gateway not found. Make sure the gateway is running: npm run dev:gateway';
      } else if (response.status === 503 || response.status === 500) {
        errorMessage = 'Pose detection service unavailable. Make sure the pose detection service is running: npm run dev:pose';
      }
      
      return NextResponse.json(
        { error: errorMessage, ok: false },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Get OpenRouter feedback (non-blocking - don't fail if it errors)
    console.log('[Pose Analysis] ========== STARTING OPENROUTER FEEDBACK ==========');
    let openRouterFeedback: string | null = null;
    let openRouterError: string | null = null;
    let openRouterStep: string | null = null;
    
    try {
      console.log('[Pose Analysis] Getting OpenRouter feedback...');
      // Create a new File from the buffer for OpenRouter (reuse the buffer)
      const openRouterFileBlob = new Blob([fileBuffer], { type: file.type });
      const openRouterFile = new File([openRouterFileBlob], file.name, { type: file.type });
      
      const openRouterResult = await getOpenRouterFeedback(openRouterFile, authHeader);
      
      console.log('[Pose Analysis] OpenRouter result:', {
        success: openRouterResult.success,
        hasFeedback: !!openRouterResult.feedback,
        hasError: !!openRouterResult.error,
        step: openRouterResult.step,
      });

      if (openRouterResult.success && openRouterResult.feedback) {
        openRouterFeedback = openRouterResult.feedback;
        console.log('[Pose Analysis] OpenRouter feedback received:', openRouterFeedback.substring(0, 100) + '...');
        // Keep OpenRouter feedback separate from formAnalysis.feedback to avoid duplication
        // Only add it as a top-level property for easy access
        result.openRouterFeedback = openRouterFeedback;
      } else {
        openRouterError = openRouterResult.error || 'Unknown error';
        openRouterStep = openRouterResult.step || 'UNKNOWN';
        console.error('[Pose Analysis] OpenRouter feedback failed:', {
          error: openRouterError,
          step: openRouterStep,
        });
        // Add error info to result so user can see what failed
        result.openRouterError = {
          error: openRouterError,
          step: openRouterStep,
          message: `OpenRouter feedback failed at step: ${openRouterStep}. Error: ${openRouterError}`,
        };
      }
    } catch (error: any) {
      openRouterError = error.message || 'Unknown error';
      openRouterStep = 'EXCEPTION';
      console.error('[Pose Analysis] Exception getting OpenRouter feedback:', {
        error: error.message,
        stack: error.stack,
      });
      result.openRouterError = {
        error: openRouterError,
        step: openRouterStep,
        message: `Exception getting OpenRouter feedback: ${openRouterError}`,
      };
    }
    
    console.log('[Pose Analysis] ========== OPENROUTER FEEDBACK COMPLETE ==========');
    console.log('[Pose Analysis] Final status:', {
      hasFeedback: !!openRouterFeedback,
      hasError: !!openRouterError,
      errorStep: openRouterStep,
    });
    
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
            videoUrl || undefined, // Use provided videoUrl if available
            sessionId || undefined
          );
          // Add analysis ID to response
          result.analysisId = analysisId;
          // Optionally update session with embedded analysis
          if (sessionId) {
            try {
              await updateSessionVideoAnalysis(sessionId, result);
              // Revalidate pages that show sessions/videos
              try {
                revalidatePath('/videos');
              } catch {}
            } catch (e) {
              console.error('Failed to update session with analysis:', e);
            }
            // Trigger drill recommendations and persist on the session
            try {
              const recUrl = config.drillRecommender.url || 'http://localhost:5001';
              const recResp = await fetch(`${recUrl}/api/drills/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysis: result }),
              });
              if (recResp.ok) {
                const recs = await recResp.json();
                await updateSessionRecommendations(sessionId, recs);
                try {
                  revalidatePath('/drills');
                } catch {}
              }
            } catch (err) {
              // non-fatal
              console.warn('Failed to generate or save drill recommendations', err);
            }
          }
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
        { error: 'Video analysis took too long. Try a shorter video or reduce the number of frames.', ok: false },
        { status: 408 }
      );
    }
    
    // Handle network errors
    if (error.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Could not connect to the analysis backend. Confirm the gateway is running and reachable.', ok: false },
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

