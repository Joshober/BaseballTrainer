# Auth0 Setup Guide

This guide will walk you through setting up Auth0 authentication for the Baseball Swing Analysis app.

## 🚀 Quick Setup (10 minutes)

### Step 1: Create Auth0 Account

1. Go to [Auth0](https://auth0.com/)
2. Click **"Sign Up"** (free tier available)
3. Create your account

### Step 2: Create Auth0 Application

1. In Auth0 Dashboard, go to **Applications** → **Applications**
2. Click **"Create Application"**
3. Enter name: `Baseball Swing App`
4. Select **"Regular Web Application"**
5. Click **"Create"**

### Step 3: Configure Application Settings

1. In your application settings, find:
   - **Domain**: Copy this (e.g., `your-app.auth0.com`)
   - **Client ID**: Copy this
   - **Client Secret**: Click "Show" and copy this

2. Scroll down to **Application URIs**:
   - **Allowed Callback URLs**: Add `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: Add `http://localhost:3000`
   - **Allowed Web Origins**: Add `http://localhost:3000`

3. Click **"Save Changes"**

### Step 4: Enable Social Connections (Google)

1. Go to **Authentication** → **Social**
2. Click **"Google"**
3. Toggle **"Enabled"**
4. Enter your Google OAuth credentials (or use Auth0's default)
5. Click **"Save"**

### Step 5: Configure Database Connection (Email/Password)

1. Go to **Authentication** → **Database**
2. Find **"Username-Password-Authentication"**
3. Ensure it's enabled
4. Configure password policy if needed

### Step 6: Add Environment Variables

Add to `.env.local` in the project root:

```env
# Auth0 Configuration
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_SECRET=use_a_long_random_string_here
AUTH0_AUDIENCE=your_api_identifier  # Optional, for API access
AUTH0_SCOPE=openid profile email
```

**Important**: 
- `AUTH0_SECRET` should be a long random string (at least 32 characters)
- You can generate one with: `openssl rand -hex 32`

### Step 7: Install Dependencies

```bash
npm install
```

This will install `@auth0/nextjs-auth0` and other required packages.

### Step 8: Test Authentication

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/login`
3. Click **"Continue with Google"** or sign in with email
4. You should be redirected to Auth0 login page
5. After login, you'll be redirected back to the app

## 🔧 Production Setup

For production, update the following in Auth0 Dashboard:

1. **Allowed Callback URLs**: Add your production URL
   - `https://yourdomain.com/api/auth/callback`

2. **Allowed Logout URLs**: Add your production URL
   - `https://yourdomain.com`

3. **Allowed Web Origins**: Add your production URL
   - `https://yourdomain.com`

4. Update `.env.local` (or production environment variables):
   ```env
   AUTH0_BASE_URL=https://yourdomain.com
   ```

## 🔑 Key Differences from Firebase

- **User ID**: Auth0 uses `sub` (subject) instead of Firebase's `uid`
- **Token**: Auth0 uses access tokens instead of ID tokens
- **Authentication Flow**: Auth0 uses redirect-based authentication
- **User Object**: Auth0 user object has different structure

## 📝 API Token Verification

For server-side API routes, Auth0 tokens are verified using JWKS (JSON Web Key Set).

The token verification:
- Validates token signature
- Checks expiration
- Verifies audience and issuer
- Returns decoded token with user information

## 🐛 Troubleshooting

### "Invalid token" errors

1. Check that `AUTH0_DOMAIN` is set correctly
2. Verify `AUTH0_SECRET` is set (required for session encryption)
3. Ensure callback URLs are configured in Auth0 Dashboard

### "Callback URL mismatch" errors

1. Check Allowed Callback URLs in Auth0 Dashboard
2. Ensure `AUTH0_BASE_URL` matches your app URL
3. For local development, use `http://localhost:3000`

### Social login not working

1. Verify social connection is enabled in Auth0 Dashboard
2. Check that OAuth credentials are configured
3. Ensure callback URLs include the social provider

## 📚 Additional Resources

- [Auth0 Next.js SDK Documentation](https://auth0.com/docs/quickstart/webapp/nextjs)
- [Auth0 Dashboard](https://manage.auth0.com/)
- [Auth0 Community](https://community.auth0.com/)

