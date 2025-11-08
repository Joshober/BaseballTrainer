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

