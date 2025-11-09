import { config } from './config';
import { getBackendUrl } from './backend-url';

const GENERIC_PHRASES = [
  'form looks good',
  'keep practicing',
  'no major form errors detected',
  'no significant issues',
  'no feedback available',
  'looks good overall',
  'looks great',
  'no major issues',
  'continue practicing',
  'great job',
  'well done',
  'excellent swing',
  'keep up the good work',
  'solid swing',
  'keep working',
  'good form',
  'maintain',
  'practice more',
];

const CORRECTIVE_ACTION_WORDS = [
  'fix',
  'adjust',
  'correct',
  'improve',
  'change',
  'modify',
  'straighten',
  'bend',
  'rotate',
  'shift',
  'lower',
  'raise',
  'tuck',
  'extend',
  'shorten',
  'widen',
  'narrow',
  'tighten',
  'loosen',
  'flare',
  'keep',
  'maintain',
  'drive',
  'lead',
  'coil',
];

export function hasSpecificCorrection(text: string): boolean {
  const lower = text.toLowerCase();
  return CORRECTIVE_ACTION_WORDS.some((word) => lower.includes(word));
}

export function isGenericResponse(text: string | null | undefined): boolean {
  if (!text || text.trim().length < 30) return true;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length < 2) return true;

  const lower = text.toLowerCase();

  if (GENERIC_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  if (!hasSpecificCorrection(text)) {
    return true;
  }

  return false;
}

export function normalizeFeedback(feedback: string | null | undefined): string | null {
  if (!feedback) return null;

  const sentences = feedback
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length < 2) return null;

  const selected = sentences.slice(0, 3).map((sentence) => {
    const cleaned = sentence.replace(/\s+/g, ' ').trim();
    return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
  });

  return selected.join(' ');
}

export function generateFallbackFeedback(): string {
  return (
    'Fix your back elbow by keeping it closer to your body and tucking it during the load phase to create better hip-shoulder separation. ' +
    'Adjust your weight transfer by staying on your back leg longer and shifting forward only after your hands start moving, not before. ' +
    'Correct your bat path by driving the knob of the bat directly to the ball instead of casting or sweeping, which will improve contact quality and exit velocity.'
  );
}

export async function queryOpenRouter(frames: any[]): Promise<{ success: boolean; feedback: string | null; error: string | null }> {
  console.log('[OpenRouter] ========== QUERY OPENROUTER START ==========');
  
  try {
    if (!config.openRouter.apiKey) {
      const error = 'OpenRouter API key not configured';
      console.error(`[OpenRouter] ERROR: ${error}`);
      return { success: false, feedback: null, error };
    }

    if (frames.length === 0) {
      const error = 'No frames provided to OpenRouter';
      console.error(`[OpenRouter] ERROR: ${error}`);
      return { success: false, feedback: null, error };
    }

    const model = config.openRouter.model || 'anthropic/claude-3.5-sonnet';
    
    // Simplified prompt for short, concise feedback
    const systemPrompt = 'You are a professional baseball hitting coach. Provide brief, actionable feedback (1-2 sentences) with specific corrections. Use imperative commands like "Fix your elbow", "Adjust your stance".';
    const userPrompt = 'Analyze this swing frame and provide 1-2 sentences of specific coaching feedback. Focus on one key mechanical issue that needs correction.';

    console.log('[OpenRouter] Configuration:', {
      model,
      apiUrl: config.openRouter.apiUrl,
      framesCount: frames.length,
      hasApiKey: !!config.openRouter.apiKey,
    });

    // Build user content with frame
    const userContent = [
      {
        type: 'text',
        text: userPrompt,
      },
      ...frames,
    ];

    const requestBody = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_tokens: 200, // Reduced for shorter responses
      temperature: 0.5, // Slightly higher for more varied responses
    };

    console.log('[OpenRouter] Request details:', {
      model: requestBody.model,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      framesCount: frames.length,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
    });

    console.log('[OpenRouter] Making API call to OpenRouter...');
    const startTime = Date.now();
    
    const response = await fetch(config.openRouter.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openRouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Baseball Trainer',
      },
      body: JSON.stringify(requestBody),
    });

    const responseTime = Date.now() - startTime;
    console.log(`[OpenRouter] API response received in ${responseTime}ms`);
    console.log(`[OpenRouter] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        console.error(`[OpenRouter] ERROR: Response not OK. Status: ${response.status}`);
        console.error(`[OpenRouter] ERROR: Response text: ${errorText}`);
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
      } catch (parseError: any) {
        console.error(`[OpenRouter] ERROR: Failed to parse error response:`, parseError);
        errorData = { error: 'Failed to parse error response' };
      }
      
      const error = `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`;
      console.error(`[OpenRouter] ERROR: ${error}`);
      return { success: false, feedback: null, error };
    }

    let data: any = {};
    try {
      const responseText = await response.text();
      console.log(`[OpenRouter] Response text length: ${responseText.length} characters`);
      data = JSON.parse(responseText);
    } catch (parseError: any) {
      const error = `Failed to parse OpenRouter response: ${parseError.message}`;
      console.error(`[OpenRouter] ERROR: ${error}`);
      console.error(`[OpenRouter] ERROR: Parse error stack:`, parseError.stack);
      return { success: false, feedback: null, error };
    }

    console.log('[OpenRouter] Response data structure:', {
      hasChoices: !!data.choices,
      choicesCount: data.choices?.length || 0,
      model: data.model || 'unknown',
      responseId: data.id || 'no-id',
      usage: data.usage || 'no-usage-data',
    });

    if (!data.choices || data.choices.length === 0) {
      const error = 'OpenRouter response has no choices';
      console.error(`[OpenRouter] ERROR: ${error}`);
      console.error(`[OpenRouter] ERROR: Full response data:`, JSON.stringify(data, null, 2));
      return { success: false, feedback: null, error };
    }

    const rawFeedback = data.choices[0]?.message?.content || null;

    console.log('[OpenRouter] Raw feedback extracted:', {
      hasFeedback: !!rawFeedback,
      feedbackLength: rawFeedback?.length || 0,
      feedbackPreview: rawFeedback ? rawFeedback.substring(0, 150) : 'null',
    });

    if (!rawFeedback) {
      const error = 'OpenRouter response has no feedback content';
      console.error(`[OpenRouter] ERROR: ${error}`);
      console.error(`[OpenRouter] ERROR: Choice structure:`, JSON.stringify(data.choices[0], null, 2));
      return { success: false, feedback: null, error };
    }

    // Return the feedback directly - no normalization or validation for simplicity
    console.log('[OpenRouter] ========== QUERY OPENROUTER SUCCESS ==========');
    console.log('[OpenRouter] Final feedback:', rawFeedback.trim());
    
    return { success: true, feedback: rawFeedback.trim(), error: null };
  } catch (error: any) {
    const errorMessage = `Unexpected error in queryOpenRouter: ${error.message}`;
    console.error(`[OpenRouter] ERROR: ${errorMessage}`);
    console.error(`[OpenRouter] ERROR: Stack trace:`, error.stack);
    return { success: false, feedback: null, error: errorMessage };
  }
}

export async function getOpenRouterFeedback(
  videoFile: File, 
  authHeader: string
): Promise<{ success: boolean; feedback: string | null; error: string | null; step: string }> {
  console.log('[OpenRouter] ========== GET OPENROUTER FEEDBACK START ==========');
  console.log('[OpenRouter] Step: INITIALIZATION');
  console.log('[OpenRouter] Video file details:', {
    name: videoFile.name,
    size: videoFile.size,
    type: videoFile.type,
    lastModified: videoFile.lastModified,
  });

  // Step 1: Validate API key
  if (!config.openRouter.apiKey) {
    const error = 'OpenRouter API key not configured';
    console.error(`[OpenRouter] ERROR at step INITIALIZATION: ${error}`);
    return { success: false, feedback: null, error, step: 'INITIALIZATION' };
  }
  console.log('[OpenRouter] API key is configured');

  try {
    // Step 2: Extract 1 frame from video
    console.log('[OpenRouter] Step: FRAME_EXTRACTION');
    const gatewayUrl = getBackendUrl();
    const extractFramesUrl = `${gatewayUrl}/api/pose/extract-frames`;

    console.log('[OpenRouter] Frame extraction configuration:', {
      gatewayUrl,
      extractFramesUrl,
      frameInterval: 1, // Extract every frame, we'll take the first one
    });

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('frameInterval', '1'); // Extract every frame to get first frame

    console.log('[OpenRouter] Sending frame extraction request...');
    console.log('[OpenRouter] Request details:', {
      url: extractFramesUrl,
      method: 'POST',
      hasAuthHeader: !!authHeader,
      videoFileName: videoFile.name,
      videoFileSize: videoFile.size,
    });

    const extractionStartTime = Date.now();
    let framesResponse: Response;
    try {
      framesResponse = await fetch(extractFramesUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      });
    } catch (fetchError: any) {
      const error = `Failed to connect to frame extraction endpoint: ${fetchError.message}`;
      console.error(`[OpenRouter] ERROR at step FRAME_EXTRACTION: ${error}`);
      console.error(`[OpenRouter] ERROR: Fetch error details:`, {
        message: fetchError.message,
        code: fetchError.code,
        stack: fetchError.stack,
      });
      return { success: false, feedback: null, error, step: 'FRAME_EXTRACTION' };
    }

    const extractionTime = Date.now() - extractionStartTime;
    console.log(`[OpenRouter] Frame extraction response received in ${extractionTime}ms`);
    console.log('[OpenRouter] Frame extraction response status:', {
      status: framesResponse.status,
      statusText: framesResponse.statusText,
      ok: framesResponse.ok,
      headers: Object.fromEntries(framesResponse.headers.entries()),
    });

    if (!framesResponse.ok) {
      let errorText = '';
      let errorData: any = {};
      try {
        errorText = await framesResponse.text();
        console.error(`[OpenRouter] ERROR: Frame extraction failed with status ${framesResponse.status}`);
        console.error(`[OpenRouter] ERROR: Response text: ${errorText.substring(0, 500)}`);
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
      } catch (parseError: any) {
        console.error(`[OpenRouter] ERROR: Failed to read error response:`, parseError);
        errorData = { error: 'Failed to read error response' };
      }

      const error = `Frame extraction failed: ${framesResponse.status} ${framesResponse.statusText}. ${JSON.stringify(errorData)}`;
      console.error(`[OpenRouter] ERROR at step FRAME_EXTRACTION: ${error}`);
      return { success: false, feedback: null, error, step: 'FRAME_EXTRACTION' };
    }

    // Step 3: Parse frame extraction response
    console.log('[OpenRouter] Step: PARSE_FRAMES');
    let framesData: any = {};
    try {
      const responseText = await framesResponse.text();
      console.log(`[OpenRouter] Frame extraction response text length: ${responseText.length} characters`);
      framesData = JSON.parse(responseText);
    } catch (parseError: any) {
      const error = `Failed to parse frame extraction response: ${parseError.message}`;
      console.error(`[OpenRouter] ERROR at step PARSE_FRAMES: ${error}`);
      console.error(`[OpenRouter] ERROR: Parse error stack:`, parseError.stack);
      return { success: false, feedback: null, error, step: 'PARSE_FRAMES' };
    }

    console.log('[OpenRouter] Frame extraction response data:', {
      ok: framesData.ok,
      framesCount: framesData.frames?.length || 0,
      extractedFrames: framesData.extractedFrames || 'unknown',
      totalFrames: framesData.totalFrames || 'unknown',
      hasFrames: !!framesData.frames,
    });

    if (!framesData.ok) {
      const error = `Frame extraction returned error: ${framesData.error || 'Unknown error'}`;
      console.error(`[OpenRouter] ERROR at step PARSE_FRAMES: ${error}`);
      return { success: false, feedback: null, error, step: 'PARSE_FRAMES' };
    }

    if (!framesData.frames || framesData.frames.length === 0) {
      const error = `No frames extracted from video. Response: ${JSON.stringify(framesData)}`;
      console.error(`[OpenRouter] ERROR at step PARSE_FRAMES: ${error}`);
      return { success: false, feedback: null, error, step: 'PARSE_FRAMES' };
    }

    // Step 4: Prepare first frame for OpenRouter
    console.log('[OpenRouter] Step: PREPARE_FRAME');
    const firstFrame = framesData.frames[0];
    console.log('[OpenRouter] First frame details:', {
      frameIndex: firstFrame.frameIndex,
      hasImage: !!firstFrame.image,
      imageLength: firstFrame.image?.length || 0,
      imagePreview: firstFrame.image?.substring(0, 50) || 'no image',
    });

    if (!firstFrame.image) {
      const error = 'First frame has no image data';
      console.error(`[OpenRouter] ERROR at step PREPARE_FRAME: ${error}`);
      return { success: false, feedback: null, error, step: 'PREPARE_FRAME' };
    }

    const base64Data = firstFrame.image.replace(/^data:image\/jpeg;base64,/, '');
    console.log('[OpenRouter] Base64 data length:', base64Data.length);

    const frameForOpenRouter = {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${base64Data}`,
        detail: 'high',
      },
    };

    console.log('[OpenRouter] Frame prepared for OpenRouter:', {
      type: frameForOpenRouter.type,
      hasImageUrl: !!frameForOpenRouter.image_url.url,
      urlLength: frameForOpenRouter.image_url.url.length,
    });

    // Step 5: Call OpenRouter with single frame
    console.log('[OpenRouter] Step: OPENROUTER_API_CALL');
    const openRouterResult = await queryOpenRouter([frameForOpenRouter]);

    if (!openRouterResult.success) {
      const error = `OpenRouter API call failed: ${openRouterResult.error}`;
      console.error(`[OpenRouter] ERROR at step OPENROUTER_API_CALL: ${error}`);
      return { success: false, feedback: null, error, step: 'OPENROUTER_API_CALL' };
    }

    if (!openRouterResult.feedback) {
      const error = 'OpenRouter returned no feedback';
      console.error(`[OpenRouter] ERROR at step OPENROUTER_API_CALL: ${error}`);
      return { success: false, feedback: null, error, step: 'OPENROUTER_API_CALL' };
    }

    console.log('[OpenRouter] ========== GET OPENROUTER FEEDBACK SUCCESS ==========');
    console.log('[OpenRouter] Final feedback:', openRouterResult.feedback);

    return { 
      success: true, 
      feedback: openRouterResult.feedback, 
      error: null,
      step: 'COMPLETE'
    };
  } catch (error: any) {
    const errorMessage = `Unexpected error in getOpenRouterFeedback: ${error.message}`;
    console.error(`[OpenRouter] ERROR: ${errorMessage}`);
    console.error(`[OpenRouter] ERROR: Stack trace:`, error.stack);
    return { success: false, feedback: null, error: errorMessage, step: 'UNKNOWN' };
  }
}

