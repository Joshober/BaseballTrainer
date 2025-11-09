# Environment Variables Setup Guide

## Where to Update Environment Variables

Create or edit the `.env.local` file in the **root directory** of your project:

```
baseballhackathon/
├── .env.local          ← Create/Edit this file here
├── package.json
├── app/
├── lib/
└── ...
```

## Required Auth0 Environment Variables

Add these to your `.env.local` file:

```env
# Auth0 Configuration (Required - Backend Gateway)
# Auth0 authentication is handled by the backend gateway
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_BASE_URL=http://localhost:3001  # Backend gateway URL (not frontend!)
AUTH0_AUDIENCE=your_api_identifier  # Optional
AUTH0_SCOPE=openid profile email

# Frontend URL (for Auth0 callback redirect)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Backend Gateway Port
GATEWAY_PORT=3001
```

## How to Get Auth0 Credentials

1. **Go to Auth0 Dashboard**: https://manage.auth0.com/
2. **Create Application** (if you haven't already):
   - Applications → Create Application
   - Name: `Baseball Swing App`
   - Type: **Regular Web Application**
   - Click **Create**

3. **Get Your Credentials**:
   - **Domain**: Found at the top of your Auth0 Dashboard (e.g., `your-app.auth0.com`)
   - **Client ID**: Found in your Application settings
   - **Client Secret**: Click "Show" in Application settings to reveal it

4. **Configure Callback URLs** in Auth0 Dashboard:
   - **Allowed Callback URLs**: `http://localhost:3001/api/auth/callback` (Backend gateway URL)
   - **Allowed Logout URLs**: `http://localhost:3000` (Frontend URL)
   - **Allowed Web Origins**: `http://localhost:3000` (Frontend URL)
   
   **Important**: The callback URL goes to the **backend gateway** (port 3001), not the frontend!

## Example .env.local File

```env
# Auth0 Configuration (Backend Gateway)
AUTH0_DOMAIN=dev-abc123.us.auth0.com
AUTH0_CLIENT_ID=abc123xyz789
AUTH0_CLIENT_SECRET=secret_abc123xyz789
AUTH0_BASE_URL=http://localhost:3001  # Backend gateway port
AUTH0_SCOPE=openid profile email

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Storage Server
STORAGE_SERVER_URL=http://localhost:5003
STORAGE_SERVER_PORT=5003

# MongoDB (if using)
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority"
DATABASE_TYPE=mongodb

# OpenRouter API (for AI coaching feedback)
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## OpenRouter API Key Setup

To enable AI coaching feedback via OpenRouter:

1. **Get an API Key**:
   - Go to https://openrouter.ai/
   - Sign up or log in
   - Navigate to your API keys section
   - Create a new API key

2. **Add to `.env.local`**:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

3. **Usage**: The OpenRouter integration is used for AI-powered coaching feedback on video analysis. When users click "Analyze" on a video, frames are extracted and sent to OpenRouter's vision models for analysis.
# Drill Recommender AI Integration (Optional)
# These are optional - if not provided, recommendations will work without AI enhancement
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_GEMINI_MODEL_ID=gemini-flash-latest   # Optional override for clubhouse coach
SERPAPI_KEY=your_serpapi_key_here

# ElevenLabs Voice Narration (Optional but recommended for audio feedback)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_DOMINICAN_VOICE_ID=voice_id_for_dominican_slugger
ELEVENLABS_JAPANESE_VOICE_ID=voice_id_for_japanese_ace
ELEVENLABS_BLACK_AMERICAN_VOICE_ID=voice_id_for_black_american_all_star
NEXT_PUBLIC_ELEVENLABS_DOMINICAN_VOICE_ID=voice_id_for_dominican_slugger
NEXT_PUBLIC_ELEVENLABS_JAPANESE_VOICE_ID=voice_id_for_japanese_ace
NEXT_PUBLIC_ELEVENLABS_BLACK_AMERICAN_VOICE_ID=voice_id_for_black_american_all_star
# Optional tuning overrides (sensible defaults applied if omitted)
ELEVENLABS_MODEL_ID=eleven_turbo_v2
ELEVENLABS_STABILITY=0.35
ELEVENLABS_SIMILARITY_BOOST=0.75
ELEVENLABS_STYLE=0.5
ELEVENLABS_SPEAKER_BOOST=true
```

## Drill Recommender AI Integration (Optional)

The drill recommender service can be enhanced with AI insights and YouTube video search. These features are optional and will gracefully fallback if API keys are not provided.

### Google Gemini AI

1. **Get API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the API key

2. **Add to `.env.local`**:
   ```env
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **What it does**:
   - Enhances drill recommendations with AI-generated insights
   - Explains why each drill is recommended for specific corrections/metrics
   - Provides personalized guidance for each drill

### SerpAPI (YouTube Video Search)

1. **Get API Key**:
   - Go to [SerpAPI](https://serpapi.com/)
   - Sign up for a free account (100 searches/month free)
   - Go to Dashboard → API Key
   - Copy your API key

2. **Add to `.env.local`**:
   ```env
   SERPAPI_KEY=your_serpapi_key_here
   ```

3. **What it does**:
   - Automatically finds relevant YouTube videos for each recommended drill
   - Updates the `videoUrl` field in drill recommendations
   - Searches using drill name + corrections for better relevance

### Notes

- Both API keys are **optional** - recommendations will work without them
- If Gemini API fails, recommendations return without AI insights
- If SerpAPI fails, recommendations return without video URLs
- The service logs warnings if API keys are missing but continues to function

## ElevenLabs Voice Narration

Bring your drill recommendations to life with play-by-play style narration from voices inspired by iconic baseball personalities.

### 1. Create an ElevenLabs Account & API Key
- Visit [ElevenLabs](https://elevenlabs.io/) and create an account.
- From the dashboard, generate an **API Key** and add it to `.env.local` as `ELEVENLABS_API_KEY`.

### 2. Choose or Create Voices
- ElevenLabs offers a **Voice Library** with community voices and the ability to train custom voices.
- Pick voices that match the following personas:
  - Dominican slugger with lively energy
  - Japanese pitching ace with disciplined tone
  - Black American clubhouse leader with warm authority
- Copy each voice's **Voice ID** and set them in `.env.local` using:
  - `ELEVENLABS_DOMINICAN_VOICE_ID`
  - `ELEVENLABS_JAPANESE_VOICE_ID`
  - `ELEVENLABS_BLACK_AMERICAN_VOICE_ID`
  - `NEXT_PUBLIC_ELEVENLABS_DOMINICAN_VOICE_ID`
  - `NEXT_PUBLIC_ELEVENLABS_JAPANESE_VOICE_ID`
  - `NEXT_PUBLIC_ELEVENLABS_BLACK_AMERICAN_VOICE_ID`

### 3. Optional Fine Tuning
- The defaults for stability, similarity boost, style, and speaker boost are tuned for an energetic clubhouse vibe.
- Override them in `.env.local` if you want more mellow or more aggressive deliveries.

### 4. Restart Servers
- Restart the Next.js dev server (`npm run dev`) and the backend gateway (`npm run dev:gateway`) after adding the new environment variables.


## Important Notes

1. **Never commit `.env.local` to git** - It's already in `.gitignore`
2. **AUTH0_BASE_URL** should match your **backend gateway** URL:
   - Development: `http://localhost:3001` (Backend gateway port)
   - Production: `https://your-backend-domain.com`
   
3. **NEXT_PUBLIC_FRONTEND_URL** should match your **frontend** URL:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
4. **Restart your dev server** after updating `.env.local`:
   ```bash
   npm run dev
   ```

## Troubleshooting

### "AUTH0_DOMAIN is not configured"
- Make sure `.env.local` exists in the root directory
- Check that `AUTH0_DOMAIN` is set correctly
- Restart your dev server

### "Invalid token" errors
- Check that callback URLs are configured in Auth0 Dashboard
- Ensure `AUTH0_BASE_URL` matches your backend gateway URL (port 3001)
- Verify `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` are set correctly

### Backend Gateway Not Running
- Make sure the backend gateway is running: `npm run dev:gateway`
- The backend gateway handles all Auth0 authentication
- Frontend redirects to backend gateway for login/logout

### Dependency conflicts
- No longer needed! Auth0 is now in the backend gateway, not the frontend
- Just run: `npm install`

