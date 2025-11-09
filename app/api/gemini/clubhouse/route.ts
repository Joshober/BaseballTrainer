import { NextRequest } from 'next/server';

interface ClubhousePayload {
  question?: string;
  metrics?: Record<string, number | string | null | undefined>;
  corrections?: string[];
  drills?: Array<{ name: string; description?: string | null }>;
}

const DEFAULT_GEMINI_MODEL =
  process.env.GOOGLE_GEMINI_MODEL_ID ?? 'gemini-flash-latest';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Google Gemini API key' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json()) as ClubhousePayload;

    const question = body.question?.trim() ?? '';
    const metricsSummary = buildMetricsSummary(body.metrics ?? {});
    const correctionsSummary =
      (body.corrections?.length ?? 0) > 0
        ? `Focus corrections: ${body.corrections?.map((item) => humanize(item)).join(', ')}.`
        : 'No specific corrections provided.';
    const drillSummary =
      (body.drills?.length ?? 0) > 0
        ? `Recommended drills on deck: ${body.drills
            ?.map((drill, index) => `${index + 1}. ${drill.name}${drill.description ? ` – ${drill.description}` : ''}`)
            .join(' | ')}`
        : 'No drill recommendations currently loaded.';

    const userPrompt = [
      'You are Coach Gemini, a sassy but insightful baseball swing instructor.',
      'Your job is to roast the player with clever, slightly mean clubhouse humor, while still giving concrete mechanical advice.',
      'Keep it PG-13: sarcastic jabs, inside baseball references, and tough love are welcome, but no profanity or personal attacks outside the swing.',
      'Blend comedy with actionable feedback. Deliver 3-5 short paragraphs.',
      'Finish with a motivational mic-drop line that mixes encouragement and swagger.',
      '',
      `Player question: ${question || 'Break down my swing like I stole your sunflower seeds.'}`,
      metricsSummary,
      correctionsSummary,
      drillSummary,
    ]
      .filter(Boolean)
      .join('\n');

    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`
    );
    url.searchParams.set('key', apiKey);

    const geminiResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 32,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gemini API request failed',
          details: errorBody,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geminiJson = await geminiResponse.json();
    const answer = extractGeminiText(geminiJson);

    if (!answer) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gemini response was empty',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        answer,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Clubhouse Gemini error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error?.message ?? 'Unexpected error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function humanize(value: string) {
  return value.replace(/[_-]/g, ' ');
}

function buildMetricsSummary(metrics: Record<string, unknown>) {
  const metricEntries = Object.entries(metrics ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${humanize(key)}: ${value}`);

  if (metricEntries.length === 0) {
    return 'No swing metrics captured.';
  }

  return `Latest swing metrics: ${metricEntries.join(' | ')}.`;
}

function extractGeminiText(response: any): string | null {
  const candidates = response?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.trim().length > 0) {
          return part.text.trim();
        }
      }
    }
  }

  return null;
}


