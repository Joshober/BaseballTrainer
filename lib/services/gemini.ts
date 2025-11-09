export interface ClubhouseCoachRequest {
  question?: string;
  metrics?: Record<string, number | string | null | undefined>;
  corrections?: string[];
  drills?: Array<{ name: string; description?: string | null }>;
}

export interface ClubhouseCoachResponse {
  success: boolean;
  answer?: string;
  error?: string;
  details?: string;
}

export async function askClubhouseCoach(
  payload: ClubhouseCoachRequest
): Promise<ClubhouseCoachResponse> {
  const response = await fetch('/api/gemini/clubhouse', {
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

    throw new Error(
      detailedError || `Clubhouse coach failed (${response.status})`
    );
  }

  return response.json();
}


