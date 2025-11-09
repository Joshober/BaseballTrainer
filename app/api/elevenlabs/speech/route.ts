import { NextRequest } from 'next/server';

type BaseballVoice = 'dominican' | 'japanese' | 'black_american' | 'american_coach';

const VOICE_ENV_MAP: Record<BaseballVoice, string | undefined> = {
  dominican: process.env.ELEVENLABS_DOMINICAN_VOICE_ID,
  japanese: process.env.ELEVENLABS_JAPANESE_VOICE_ID,
  black_american: process.env.ELEVENLABS_BLACK_AMERICAN_VOICE_ID,
  american_coach: process.env.AMERICAN_COACH_ID,
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing ElevenLabs configuration',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { text, voice }: { text?: string; voice?: BaseballVoice } =
      await request.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No text provided for narration',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!voice) {
      return new Response(
        JSON.stringify({
          error: 'No voice selected',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const voiceId = VOICE_ENV_MAP[voice];

    if (!voiceId) {
      return new Response(
        JSON.stringify({
          error: `Voice configuration missing for "${voice}"`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2',
          voice_settings: {
            stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.35),
            similarity_boost: Number(
              process.env.ELEVENLABS_SIMILARITY_BOOST ?? 0.75
            ),
            style: Number(process.env.ELEVENLABS_STYLE ?? 0.5),
            use_speaker_boost:
              process.env.ELEVENLABS_SPEAKER_BOOST !== 'false',
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorBody = await elevenLabsResponse.text();
      console.error('ElevenLabs error:', elevenLabsResponse.status, errorBody);
      return new Response(
        JSON.stringify({
          error: 'Failed to generate narration',
          details: errorBody,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('ElevenLabs narration error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message ?? 'Unexpected error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


