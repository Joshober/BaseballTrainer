import { NextRequest, NextResponse } from 'next/server';

interface GenerateDrillsPayload {
  feedback?: string;
}

const DEFAULT_GEMINI_MODEL =
  process.env.GOOGLE_GEMINI_MODEL_ID ?? 'gemini-flash-latest';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Gemini API key' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as GenerateDrillsPayload;
    const feedback = body.feedback?.trim() ?? '';

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: 'Feedback is required' },
        { status: 400 }
      );
    }

    const prompt = `You are a baseball coaching expert. Based on the following coaching feedback from a swing analysis, recommend exactly 3 specific hitting drills that will help the player improve.

Coaching Feedback:
${feedback}

For each of the 3 drills, provide:
1. Drill name (specific and descriptive, e.g., "Tee Work for Launch Angle")
2. Short description (1-2 sentences explaining what the drill does)
3. YouTube video URL (MUST be a real, existing YouTube video URL in format: https://www.youtube.com/watch?v=VIDEO_ID. Use well-known baseball hitting drill videos that actually exist. Examples of real videos: https://www.youtube.com/watch?v=dQw4w9WgXcQ is NOT valid. Use real baseball coaching channels like CoachTube, Baseball Tutorials, or verified baseball instruction videos)
4. Video description (1 sentence describing what the video shows - this should be a short description of the actual video content)
5. Rationale (1 sentence explaining why this drill addresses the issues in the feedback)

IMPORTANT: The YouTube URLs you provide MUST be real, existing videos. Do not make up video IDs. Use actual baseball hitting drill videos from reputable sources.

CRITICAL: You must return ONLY valid JSON. Do NOT include markdown code blocks, do NOT include explanations, do NOT include any text before or after the JSON. Return ONLY the JSON object starting with { and ending with }.

Required JSON format (copy this structure exactly):
{
  "drills": [
    {
      "name": "Drill Name 1",
      "description": "Description of drill 1",
      "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID_1",
      "videoDescription": "Short description of what the video shows",
      "rationale": "Why this drill helps"
    },
    {
      "name": "Drill Name 2",
      "description": "Description of drill 2",
      "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID_2",
      "videoDescription": "Short description of what the video shows",
      "rationale": "Why this drill helps"
    },
    {
      "name": "Drill Name 3",
      "description": "Description of drill 3",
      "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID_3",
      "videoDescription": "Short description of what the video shows",
      "rationale": "Why this drill helps"
    }
  ]
}

Remember: Return ONLY the JSON object, nothing else.`;

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
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorBody);
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API request failed',
          details: errorBody,
        },
        { status: 502 }
      );
    }

    const geminiJson = await geminiResponse.json();
    const responseText = extractGeminiText(geminiJson);

    if (!responseText) {
      console.error('Gemini response structure:', JSON.stringify(geminiJson, null, 2).substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini response was empty',
          details: 'No text content found in Gemini response',
        },
        { status: 502 }
      );
    }

    console.log('Gemini raw response (first 500 chars):', responseText.substring(0, 500));

    // Extract JSON from response (handle markdown code blocks and extra text)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present (handle both ```json and ```)
    jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    jsonText = jsonText.trim();
    
    // Try to find JSON object in the response
    let jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    
    // If no match, try to find it by matching braces properly
    if (!jsonMatch) {
      const startIdx = jsonText.indexOf('{');
      if (startIdx >= 0) {
        // Find the matching closing brace by counting braces
        let braceCount = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < jsonText.length; i++) {
          if (jsonText[i] === '{') braceCount++;
          if (jsonText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        if (endIdx > startIdx) {
          jsonText = jsonText.substring(startIdx, endIdx);
          jsonMatch = [jsonText];
        } else {
          // Fallback to regex match on substring
          jsonText = jsonText.substring(startIdx);
          jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        }
      }
    }
    
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response. Full response:', responseText.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse drill recommendations from Gemini response',
          details: 'No valid JSON found in response',
        },
        { status: 502 }
      );
    }

    let drillsData;
    try {
      // Try to parse the extracted JSON
      const cleanedJson = jsonMatch[0].trim();
      drillsData = JSON.parse(cleanedJson);
    } catch (parseError: any) {
      console.error('Failed to parse JSON from Gemini response:', parseError.message);
      console.error('JSON string (first 500 chars):', jsonMatch[0].substring(0, 500));
      console.error('Full response (first 1000 chars):', responseText.substring(0, 1000));
      
      // Try to fix common JSON issues
      try {
        let fixedJson = jsonMatch[0];
        
        // Remove trailing commas before } or ]
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing again
        drillsData = JSON.parse(fixedJson);
        console.log('Successfully parsed JSON after fixing trailing commas');
      } catch (secondError: any) {
        console.error('Second parse attempt failed:', secondError.message);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to parse drill recommendations',
            details: parseError.message,
          },
          { status: 502 }
        );
      }
    }

    // Validate drill structure
    if (!drillsData.drills || !Array.isArray(drillsData.drills)) {
      console.error('Invalid drill data structure. Received:', JSON.stringify(drillsData, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid drill data structure',
          details: 'Response does not contain a drills array',
        },
        { status: 502 }
      );
    }

    // Ensure we have exactly 3 drills (or at least validate the structure)
    const drills = drillsData.drills.slice(0, 3).map((drill: any, index: number) => {
      // Validate and clean YouTube URL
      let youtubeUrl = drill.youtubeUrl || '';
      if (youtubeUrl && !youtubeUrl.startsWith('http')) {
        // If it's just a video ID, construct the full URL
        if (/^[a-zA-Z0-9_-]{11}$/.test(youtubeUrl)) {
          youtubeUrl = `https://www.youtube.com/watch?v=${youtubeUrl}`;
        } else {
          // Try to extract video ID from various formats
          const videoIdMatch = youtubeUrl.match(/(?:v=|v\/|embed\/)([a-zA-Z0-9_-]{11})/);
          if (videoIdMatch) {
            youtubeUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
          }
        }
      }
      
      return {
        name: drill.name || `Drill ${index + 1}`,
        description: drill.description || 'No description provided',
        youtubeUrl: youtubeUrl || '',
        videoDescription: drill.videoDescription || drill.description || '',
        rationale: drill.rationale || '',
      };
    });
    
    // Ensure we have at least 1 drill
    if (drills.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No drills generated',
          details: 'Gemini response did not contain any valid drills',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      drills,
    });
  } catch (error: any) {
    console.error('Gemini drill generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error?.message ?? 'Unexpected error',
      },
      { status: 500 }
    );
  }
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

