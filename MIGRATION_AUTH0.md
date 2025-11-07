# Migration from Firebase Auth to Auth0

This document summarizes the changes made to migrate from Firebase Auth to Auth0.

## Changes Made

### 1. New Auth0 Libraries Created
- `lib/auth0/auth.ts` - Client-side Auth0 hooks and utilities
- `lib/auth0/config.ts` - Auth0 configuration
- `lib/auth0/admin.ts` - Server-side token verification

### 2. Updated Components
- `app/layout.tsx` - Added UserProvider wrapper
- `app/login/page.tsx` - Updated to use Auth0
- `app/signup/page.tsx` - Updated to use Auth0
- `components/Auth/AuthButton.tsx` - Updated to use Auth0

### 3. Updated API Routes
The following API routes need to be updated:
- `app/api/users/route.ts` - ✅ Updated
- `app/api/storage/route.ts` - ✅ Updated
- `app/api/sessions/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/sessions/[id]/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/messages/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/messages/read/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/conversations/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/teams/route.ts` - ⚠️ Needs update (uid → sub)
- `app/api/leaderboard/route.ts` - ⚠️ Needs update (uid → sub)

### 4. Updated Storage Server
- `storage-server/middleware/auth.py` - Updated to verify Auth0 tokens
- `storage-server/routes/storage.py` - Updated to use 'sub' instead of 'uid'
- `storage-server/requirements.txt` - Updated dependencies

### 5. Configuration
- `lib/utils/config.ts` - Added Auth0 configuration
- `package.json` - Added Auth0 dependencies, removed Firebase auth dependencies

## Key Differences

### User ID
- **Firebase**: Uses `uid` as the user identifier
- **Auth0**: Uses `sub` (subject) as the user identifier

### Token Verification
- **Firebase**: Uses Firebase Admin SDK to verify ID tokens
- **Auth0**: Uses JWKS (JSON Web Key Set) to verify access tokens

### Authentication Flow
- **Firebase**: Client-side authentication with Firebase SDK
- **Auth0**: Redirect-based authentication with Auth0 SDK

## Remaining Tasks

1. Update all API routes to:
   - Import from `@/lib/auth0/admin` instead of `@/lib/firebase/admin`
   - Change `decodedToken.uid` to `decodedToken.sub`

2. Update any components that directly use Firebase auth

3. Test authentication flow end-to-end

4. Update environment variables in `.env.local`

## Environment Variables Required

```env
# Auth0 Configuration
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_SECRET=use_a_long_random_string_here
AUTH0_AUDIENCE=your_api_identifier  # Optional
AUTH0_SCOPE=openid profile email
```

## Installation

After pulling these changes, run:
```bash
npm install
```

This will install the new Auth0 dependencies.

