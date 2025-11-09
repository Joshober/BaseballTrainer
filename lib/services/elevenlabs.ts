export type BaseballVoice = 'dominican' | 'japanese' | 'black_american';

export interface GenerateNarrationOptions {
  text: string;
  voice: BaseballVoice;
  signal?: AbortSignal;
}

export async function generateDrillNarration({
  text,
  voice,
  signal,
}: GenerateNarrationOptions): Promise<Blob> {
  const response = await fetch('/api/elevenlabs/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      errorText ||
        `Failed to generate narration (${response.status} ${response.statusText})`
    );
  }

  return response.blob();
}

export const BASEBALL_VOICE_OPTIONS: Array<{
  value: BaseballVoice;
  label: string;
  voiceId: string;
}> = [
  {
    value: 'dominican',
    label: 'Dominican Slugger',
    voiceId:
      process.env.NEXT_PUBLIC_ELEVENLABS_DOMINICAN_VOICE_ID ??
      process.env.ELEVENLABS_DOMINICAN_VOICE_ID ??
      'unknown-dominican-voice-id',
  },
  {
    value: 'japanese',
    label: 'Japanese Ace',
    voiceId:
      process.env.NEXT_PUBLIC_ELEVENLABS_JAPANESE_VOICE_ID ??
      process.env.ELEVENLABS_JAPANESE_VOICE_ID ??
      'unknown-japanese-voice-id',
  },
  {
    value: 'black_american',
    label: 'Black American All-Star',
    voiceId:
      process.env.NEXT_PUBLIC_ELEVENLABS_BLACK_AMERICAN_VOICE_ID ??
      process.env.ELEVENLABS_BLACK_AMERICAN_VOICE_ID ??
      'unknown-black-american-voice-id',
  },
];


