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
  description: string;
}> = [
  {
    value: 'dominican',
    label: 'Dominican Slugger',
    description: 'Energetic, rhythmic delivery with Latin baseball swagger',
  },
  {
    value: 'japanese',
    label: 'Japanese Ace',
    description: 'Precise, disciplined tone inspired by Nippon baseball legends',
  },
  {
    value: 'black_american',
    label: 'Black American All-Star',
    description: 'Warm, confident cadence with clubhouse leadership energy',
  },
];


