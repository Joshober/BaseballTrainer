import { GeminiDrill } from '@/types/session';

export interface GeminiDrillRequest {
  feedback: string;
}

export interface GeminiDrillResponse {
  success: boolean;
  drills?: GeminiDrill[];
  error?: string;
  details?: string;
}

export async function generateDrills(
  payload: GeminiDrillRequest
): Promise<GeminiDrillResponse> {
  const response = await fetch('/api/gemini/generate-drills', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detailedError = '';
    try {
      detailedError = await response.text();
    } catch {
      detailedError = response.statusText;
    }

    return {
      success: false,
      error: detailedError || `Drill generation failed (${response.status})`,
    };
  }

  return response.json();
}

