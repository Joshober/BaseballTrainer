import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getSession } from '@/lib/mongodb/operations';
import { getBackendUrl } from '@/lib/utils/backend-url';
import { getStorageServerUrl } from '@/lib/utils/storage-server-url';
import { config } from '@/lib/utils/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Check if response contains specific corrective action words
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

function hasSpecificCorrection(text: string): boolean {
  const lower = text.toLowerCase();
  return CORRECTIVE_ACTION_WORDS.some((word) => lower.includes(word));
}

function isGenericResponse(text: string | null | undefined): boolean {
  if (!text || text.trim().length < 30) return true;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length < 2) return true;

  const lower = text.toLowerCase();
  
  // If it contains generic phrases, it's generic
  if (GENERIC_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }
  
  // If it doesn't contain specific corrective action words, it's likely generic
  if (!hasSpecificCorrection(text)) {
    return true;
  }
  
  return false;
}

function normalizeFeedback(feedback: string | null | undefined): string | null {
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

function generateFallbackFeedback(): string {
  return (
    'Fix your back elbow by keeping it closer to your body and tucking it during the load phase to create better hip-shoulder separation. ' +
    'Adjust your weight transfer by staying on your back leg longer and shifting forward only after your hands start moving, not before. ' +
    'Correct your bat path by driving the knob of the bat directly to the ball instead of casting or sweeping, which will improve contact quality and exit velocity.'
  );
}

async function queryOpenRouter(
  frames: any[],
  attempt: number
): Promise<string | null> {
  const prompts = [
    {
      system:
        'You are an elite professional baseball hitting coach. Your responses MUST use imperative commands like "Fix your elbow", "Adjust your stance", "Correct your bat path", "Lower your hands", "Rotate your hips". Every sentence must start with or contain a specific corrective action verb. Do not use phrases like "consider", "try to", "might want to". Use direct commands: fix, adjust, correct, lower, raise, tuck, extend, rotate, shift, bend, straighten.',
      user:
        'Analyze these swing frames and provide 2-3 sentences. Each sentence MUST contain a direct correction command. Examples: "Fix your back elbow by tucking it closer to your body during the load." "Adjust your weight transfer by staying on your back leg longer." "Correct your bat path by driving the knob straight to the ball." Never say the form looks good. Always identify specific mechanical flaws and command specific fixes.',
    },
    {
      system:
        'You are a biomechanics expert. You MUST provide corrective commands. Every response must use action verbs: fix, adjust, correct, lower, raise, tuck, extend, rotate, shift. Do not provide observations without corrections. Do not say "looks good" or "no major issues". Always command specific mechanical fixes.',
      user:
        'ATTEMPT 2 - MANDATORY: You must provide 2-3 sentences with direct correction commands. Start sentences with action verbs: "Fix your [body part] by [specific action]." "Adjust your [mechanic] by [specific change]." "Correct your [issue] by [specific fix]." Identify: elbow position, hip rotation, weight transfer, bat path, hand position, shoulder separation, or stance. Each sentence must command a specific fix. No observations without corrections.',
    },
    {
      system:
        'You are a professional hitting instructor. Your ONLY job is to identify mechanical flaws and command specific fixes. Use imperative language: "Fix X", "Adjust Y", "Correct Z". Never provide generic encouragement. Never say there are no issues. Always command at least 2-3 specific mechanical corrections.',
      user:
        'FINAL ATTEMPT - REQUIRED FORMAT: Provide 2-3 sentences. Each sentence MUST: 1) Start with a correction command (Fix, Adjust, Correct, Lower, Raise, Tuck, Extend, Rotate, Shift), 2) Name a specific body part or mechanic (elbow, hips, hands, bat path, weight transfer, stance, spine angle), 3) Specify the exact correction ("by keeping it closer to your body", "by staying on your back leg longer", "by driving the knob straight"). Example: "Fix your back elbow by tucking it closer to your ribcage during the load phase to improve hip-shoulder separation."',
    },
  ];

  const promptIndex = Math.min(attempt - 1, prompts.length - 1);
  const prompt = prompts[promptIndex];
  const model = config.openRouter.model || 'anthropic/claude-3.5-sonnet';

  console.log(`[OpenRouter] Attempt ${attempt}:`, {
    model,
    apiUrl: config.openRouter.apiUrl,
    framesCount: frames.length,
    promptLength: prompt.user.length,
    hasApiKey: !!config.openRouter.apiKey,
    apiKeyPrefix: config.openRouter.apiKey ? config.openRouter.apiKey.substring(0, 10) + '...' : 'MISSING',
  });

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: prompt.system,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt.user,
          },
          ...frames,
        ],
      },
    ],
    max_tokens: 600,
    temperature: 0.3,
  };

  console.log(`[OpenRouter] Request body (excluding frames):`, {
    model: requestBody.model,
    systemPrompt: requestBody.messages[0].content.substring(0, 100) + '...',
    userPrompt: requestBody.messages[1].content[0].text.substring(0, 100) + '...',
    framesCount: frames.length,
    max_tokens: requestBody.max_tokens,
    temperature: requestBody.temperature,
  });

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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[OpenRouter] API error (attempt ${attempt}):`, {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    return null;
  }

  const data = await response.json();
  
  console.log(`[OpenRouter] Response received (attempt ${attempt}):`, {
    model: data.model || 'unknown',
    id: data.id || 'unknown',
    hasChoices: !!data.choices,
    choicesCount: data.choices?.length || 0,
    usage: data.usage || 'no usage data',
  });

  const rawFeedback = data.choices?.[0]?.message?.content || null;

  if (!rawFeedback) {
    console.warn(`[OpenRouter] No feedback content in response (attempt ${attempt})`);
    return null;
  }

  console.log(`[OpenRouter] Raw feedback (attempt ${attempt}):`, {
    length: rawFeedback.length,
    preview: rawFeedback.substring(0, 150) + '...',
  });

  const normalized = normalizeFeedback(rawFeedback);
  if (normalized && !isGenericResponse(normalized)) {
    return normalized;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[OpenRouter] Config loaded:', {
      model: config.openRouter.model,
      apiUrl: config.openRouter.apiUrl,
      hasApiKey: !!config.openRouter.apiKey,
      maxFrames: config.openRouter.maxFrames,
      apiKeyPrefix: config.openRouter.apiKey ? config.openRouter.apiKey.substring(0, 10) + '...' : 'MISSING',
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('OpenRouter: Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let token = authHeader.substring(7).trim();
    
    // Log token info for debugging (without exposing the full token)
    console.log('OpenRouter: Token received', {
      length: token.length,
      startsWith: token.substring(0, 20),
      parts: token.split('.').length,
      hasSpaces: token.includes(' '),
    });
    
    // Validate token format before attempting verification
    if (!token || token.length < 10) {
      console.error('OpenRouter: Token is empty or too short');
      return NextResponse.json({ error: 'Invalid token: token is empty or too short' }, { status: 401 });
    }
    
    // Check if token looks like a JWT (should have 3 or 5 parts separated by dots)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3 && tokenParts.length !== 5) {
      console.error('OpenRouter: Token does not have valid JWT/JWE format', {
        parts: tokenParts.length,
        tokenPreview: token.substring(0, 50) + '...',
      });
      return NextResponse.json({ 
        error: `Invalid token format: expected JWT (3 parts) or JWE (5 parts), got ${tokenParts.length} parts` 
      }, { status: 401 });
    }
    
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
      if (!decodedToken) {
        console.error('OpenRouter: Token verification returned null');
        return NextResponse.json({ error: 'Invalid token: verification returned null' }, { status: 401 });
      }
      console.log('OpenRouter: Token verified successfully', { sub: decodedToken.sub });
    } catch (tokenError: any) {
      console.error('OpenRouter: Token verification error:', {
        message: tokenError.message,
        stack: tokenError.stack,
      });
      return NextResponse.json({ 
        error: `Token verification failed: ${tokenError.message}` 
      }, { status: 401 });
    }

    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      console.error('OpenRouter: Session ID is missing');
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.uid !== decodedToken.sub) {
      console.error('OpenRouter: User does not own session:', { sessionUid: session.uid, tokenSub: decodedToken.sub });
      return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
    }

    if (!session.videoPath) {
      console.error('OpenRouter: Session does not have a video path');
      return NextResponse.json({ error: 'Session does not have a video' }, { status: 400 });
    }

    const storageServerUrl = getStorageServerUrl();
    const videoUrl = `${storageServerUrl}/api/storage/${session.videoPath}`;

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download video from storage' },
        { status: 500 }
      );
    }

    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);

    const gatewayUrl = getBackendUrl();
    const extractFramesUrl = `${gatewayUrl}/api/pose/extract-frames`;

    const formData = new FormData();
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('video', videoBlob, 'video.mp4');
    formData.append('frameInterval', '5');

    let framesData;
    try {
      const framesResponse = await fetch(extractFramesUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      });

      if (!framesResponse.ok) {
        const errorText = await framesResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Frame extraction failed' };
        }
        console.error('Frame extraction failed:', {
          status: framesResponse.status,
          statusText: framesResponse.statusText,
          error: errorData,
        });
        return NextResponse.json(
          { error: errorData.error || errorData.message || 'Failed to extract frames' },
          { status: framesResponse.status }
        );
      }

      framesData = await framesResponse.json();
    } catch (error: any) {
      console.error('Frame extraction request error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to extract frames' },
        { status: 500 }
      );
    }

    if (!framesData.ok || !framesData.frames || framesData.frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames extracted from video' },
        { status: 400 }
      );
    }

    if (!config.openRouter.apiKey) {
      console.error('OpenRouter: API key not configured');
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    // Testing: send only 1 frame
    const maxFramesForOpenRouter = 1;
    const framesToSend = framesData.frames.slice(0, maxFramesForOpenRouter);

    const frames = framesToSend.map((frame: any, index: number) => {
      const base64Data = frame.image.replace(/^data:image\/jpeg;base64,/, '');
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
          detail: index === 0 ? 'high' : 'low',
        },
      };
    });

    if (frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames to send to OpenRouter' },
        { status: 400 }
      );
    }

    console.log('OpenRouter: Starting analysis with retry logic', {
      totalFrames: framesData.frames.length,
      framesToSend: framesToSend.length,
      maxAttempts: 3,
    });

    let feedback: string | null = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`OpenRouter: Attempt ${attempt}/${maxAttempts}`);

      feedback = await queryOpenRouter(frames, attempt);

      if (feedback && !isGenericResponse(feedback)) {
        console.log(`OpenRouter: Received valid feedback on attempt ${attempt}`);
        break;
      }

      if (attempt < maxAttempts) {
        console.log(`OpenRouter: Attempt ${attempt} returned generic/invalid feedback, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!feedback || isGenericResponse(feedback)) {
      console.warn('OpenRouter: All attempts returned generic feedback, using fallback');
      feedback = generateFallbackFeedback();
    }

    console.log('OpenRouter: Final feedback', {
      feedbackLength: feedback.length,
      feedbackPreview: feedback.substring(0, 100) + '...',
    });

    return NextResponse.json({
      ok: true,
      feedback,
      framesAnalyzed: framesToSend.length,
      totalFrames: framesData.extractedFrames || framesData.frames.length,
    });
  } catch (error: any) {
    console.error('OpenRouter video analysis error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
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
