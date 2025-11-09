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

export async function queryOpenRouter(frames: any[], attempt: number): Promise<string | null> {
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
    hasApiKey: !!config.openRouter.apiKey,
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
    hasChoices: !!data.choices,
    choicesCount: data.choices?.length || 0,
  });

  const rawFeedback = data.choices?.[0]?.message?.content || null;

  if (!rawFeedback) {
    return null;
  }

  const normalized = normalizeFeedback(rawFeedback);
  if (normalized && !isGenericResponse(normalized)) {
    return normalized;
  }

  return null;
}

export async function getOpenRouterFeedback(videoFile: File, authHeader: string): Promise<string | null> {
  if (!config.openRouter.apiKey) {
    console.warn('[OpenRouter] API key not configured, skipping OpenRouter analysis');
    return null;
  }

  try {
    const gatewayUrl = getBackendUrl();
    const extractFramesUrl = `${gatewayUrl}/api/pose/extract-frames`;

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('frameInterval', '5');

    console.log('[OpenRouter] Extracting frames for analysis...');
    const framesResponse = await fetch(extractFramesUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    if (!framesResponse.ok) {
      console.error('[OpenRouter] Frame extraction failed:', framesResponse.status);
      return null;
    }

    const framesData = await framesResponse.json();
    if (!framesData.ok || !framesData.frames || framesData.frames.length === 0) {
      console.error('[OpenRouter] No frames extracted');
      return null;
    }

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
      return null;
    }

    console.log('[OpenRouter] Starting analysis with retry logic', {
      framesToSend: framesToSend.length,
      maxAttempts: 3,
    });

    let feedback: string | null = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      feedback = await queryOpenRouter(frames, attempt);

      if (feedback && !isGenericResponse(feedback)) {
        console.log(`[OpenRouter] Received valid feedback on attempt ${attempt}`);
        break;
      }

      if (attempt < maxAttempts) {
        console.log(`[OpenRouter] Attempt ${attempt} returned generic/invalid feedback, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!feedback || isGenericResponse(feedback)) {
      console.warn('[OpenRouter] All attempts returned generic feedback, using fallback');
      feedback = generateFallbackFeedback();
    }

    return feedback;
  } catch (error: any) {
    console.error('[OpenRouter] Error getting feedback:', error);
    return null;
  }
}

