import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface FakeFeedbackData {
  metrics?: {
    batLinearSpeedMph?: number;
    exitVelocityEstimateMph?: number;
    launchAngle?: number;
  };
  formAnalysis?: {
    feedback?: string[];
  };
}

type VoiceKey = 'dominican' | 'japanese' | 'black_american';

const VOICE_ID_MAP: Record<VoiceKey, string | undefined> = {
  dominican: process.env.ELEVENLABS_DOMINICAN_VOICE_ID,
  japanese: process.env.ELEVENLABS_JAPANESE_VOICE_ID,
  black_american: process.env.ELEVENLABS_BLACK_AMERICAN_VOICE_ID,
};

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is required');
  }

  const voiceArg = (process.argv[2] as VoiceKey | undefined) ?? 'dominican';

  if (!VOICE_ID_MAP[voiceArg]) {
    throw new Error(
      `Missing voice ID for "${voiceArg}". Set ELEVENLABS_${voiceArg.toUpperCase()}_VOICE_ID in .env.local`
    );
  }

  const fakeFeedbackPath = path.join(__dirname, '../fake_feedback_data.json');

  if (!fs.existsSync(fakeFeedbackPath)) {
    throw new Error(`Sample feedback not found at ${fakeFeedbackPath}`);
  }

  const feedbackData = JSON.parse(
    fs.readFileSync(fakeFeedbackPath, 'utf-8')
  ) as FakeFeedbackData;

  const parts: string[] = [
    `Welcome back to the cages. Here's a replay of your past swing notes.`,
  ];

  const metrics = feedbackData.metrics ?? {};
  if (typeof metrics.batLinearSpeedMph === 'number') {
    parts.push(
      `Bat speed previously clocked at ${metrics.batLinearSpeedMph.toFixed(
        1
      )} miles per hour.`
    );
  }
  if (typeof metrics.exitVelocityEstimateMph === 'number') {
    parts.push(
      `Projected exit velocity came in at ${metrics.exitVelocityEstimateMph.toFixed(
        1
      )} miles per hour.`
    );
  }
  if (typeof metrics.launchAngle === 'number') {
    parts.push(
      `Launch angle settled around ${metrics.launchAngle.toFixed(1)} degrees.`
    );
  }

  const feedbackList = feedbackData.formAnalysis?.feedback ?? [];
  if (feedbackList.length > 0) {
    parts.push(
      `Here are the focal points from that session: ${feedbackList
        .map((item) => item.replace(/- /g, ''))
        .join('. ')}.`
    );
  }

  parts.push(
    `Let's lock in, tidy up those mechanics, and get back after it once more.`
  );

  const text = parts.join(' ');

  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.35);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? 0.75);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0.5);
  const speakerBoost =
    process.env.ELEVENLABS_SPEAKER_BOOST !== 'false' ? true : false;

  const response = await axios.post<ArrayBuffer>(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_MAP[voiceArg]}`,
    {
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2',
      voice_settings: {
        stability,
        similarity_boost: similarity,
        style,
        use_speaker_boost: speakerBoost,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
    }
  );

  const outDir = path.join(__dirname, '../tmp');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  const outputPath = path.join(
    outDir,
    `replay-feedback-${voiceArg}-${Date.now()}.mp3`
  );

  fs.writeFileSync(outputPath, Buffer.from(response.data));
  console.log(`Saved narration to ${outputPath}`);
}

main().catch((error) => {
  console.error('[replay-elevenlabs] Failed to generate narration:', error);
  process.exit(1);
});


