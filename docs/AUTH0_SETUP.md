# Auth0 Setup Guide - Step by Step

This guide will walk you through setting up Auth0 authentication for your Baseball Swing Analysis app.

## 🚀 Quick Setup (10 minutes)

### Step 1: Create Auth0 Account

1. Go to [Auth0](https://auth0.com/)
2. Click **"Sign Up"** (free tier available - 7,000 free MAU/month)
3. Create your account with email or Google
4. Verify your email if prompted

### Step 2: Create Auth0 Application

1. Once logged in, you'll see the Auth0 Dashboard
2. In the left sidebar, click **"Applications"**
3. Click **"Create Application"** button (top right)
4. Enter application name: `Baseball Swing App`
5. Select application type: **"Regular Web Application"**
6. Click **"Create"**

### Step 3: Get Your Credentials

After creating the application, you'll see the application settings page:

1. **Domain** (at the top of the page):
   - Copy this value (e.g., `dev-abc123.us.auth0.com`)
   - This is your `AUTH0_DOMAIN`

2. **Client ID**:
   - Found in the "Basic Information" section
   - Copy this value
   - This is your `AUTH0_CLIENT_ID`

3. **Client Secret**:
   - Found in the "Basic Information" section
   - Click **"Show"** to reveal it
   - Copy this value
   - This is your `AUTH0_CLIENT_SECRET`
   - ⚠️ **Keep this secret!** Don't commit it to git.

### Step 4: Configure Application URLs

Still in your application settings, scroll down to **"Application URIs"**:

1. **Allowed Callback URLs**:
   ```
   http://localhost:3001/api/auth/callback
   ```
   - This is where Auth0 redirects after login
   - **Important**: This goes to your **backend gateway** (port 3001), not the frontend!

2. **Allowed Logout URLs**:
   ```
   http://localhost:3000
   ```
   - This is where users are redirected after logout
   - This goes to your **frontend** (port 3000)

3. **Allowed Web Origins**:
   ```
   http://localhost:3000
   ```
   - This allows CORS requests from your frontend
   - This goes to your **frontend** (port 3000)

4. Click **"Save Changes"** at the bottom

### Step 5: Enable Social Connections (Google)

1. In the left sidebar, click **"Authentication"** → **"Social"**
2. Find **"Google"** in the list
3. Click on it
4. Toggle **"Enabled"** to ON
5. You have two options:

   **Option A: Use Auth0's Default Google Connection** (Easiest)
   - Just click **"Save"**
   - Auth0 handles everything automatically
   - ✅ Recommended for quick setup

   **Option B: Use Your Own Google OAuth Credentials** (More control)
   - Click **"Create Application"** in Google Cloud Console
   - Get your Google Client ID and Client Secret
   - Enter them in Auth0
   - Click **"Save"**

6. Click **"Save"** to enable Google login

### Step 6: Configure Database Connection (Email/Password)

1. In the left sidebar, click **"Authentication"** → **"Database"**
2. Find **"Username-Password-Authentication"** (should be enabled by default)
3. Click on it
4. Ensure it's **"Enabled"**
5. Configure password policy if needed:
   - Minimum password length (default: 8)
   - Password strength requirements
6. Click **"Save"**

### Step 7: Add Environment Variables

Open your `.env.local` file in the project root and add:

```env
# Auth0 Configuration (Backend Gateway)
AUTH0_DOMAIN=dev-abc123.us.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_BASE_URL=http://localhost:3001
AUTH0_SCOPE=openid profile email

# Frontend URL (for callback redirect)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Backend Gateway Port
GATEWAY_PORT=3001
```

**Replace the values:**
- `AUTH0_DOMAIN`: Your domain from Step 3
- `AUTH0_CLIENT_ID`: Your Client ID from Step 3
- `AUTH0_CLIENT_SECRET`: Your Client Secret from Step 3

### Step 8: Test the Setup

1. **Start the backend gateway:**
   ```bash
   npm run dev:gateway
   ```
   You should see: `✅ Gateway running on port 3001`

2. **Start the frontend:**
   ```bash
   npm run dev
   ```
   You should see: `Ready on http://localhost:3000`

3. **Test login:**
   - Go to `http://localhost:3000/login`
   - Click **"Continue with Google"** or sign in with email
   - You should be redirected to Auth0 login page
   - After login, you should be redirected back to your app

## 📋 Quick Reference

### Auth0 Dashboard URLs

- **Dashboard**: https://manage.auth0.com/
- **Applications**: https://manage.auth0.com/#/applications
- **Social Connections**: https://manage.auth0.com/#/connections/social
- **Database Connections**: https://manage.auth0.com/#/connections/database

### Environment Variables Summary

```env
# Required
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_BASE_URL=http://localhost:3001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Optional
AUTH0_AUDIENCE=your_api_identifier
AUTH0_SCOPE=openid profile email
GATEWAY_PORT=3001
```

### Callback URLs Configuration

**In Auth0 Dashboard → Application Settings:**

- **Allowed Callback URLs**: 
  ```
  http://localhost:3001/api/auth/callback
  ```

- **Allowed Logout URLs**: 
  ```
  http://localhost:3000
  ```

- **Allowed Web Origins**: 
  ```
  http://localhost:3000
  ```

## 🔧 Production Setup

When deploying to production:

1. **Update Auth0 Application URLs:**
   - **Allowed Callback URLs**: `https://your-backend-domain.com/api/auth/callback`
   - **Allowed Logout URLs**: `https://your-frontend-domain.com`
   - **Allowed Web Origins**: `https://your-frontend-domain.com`

2. **Update `.env.local` (or production environment variables):**
   ```env
   AUTH0_BASE_URL=https://your-backend-domain.com
   NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-domain.com
   ```

## 🐛 Troubleshooting

### "Auth0 not configured" error

- Check that `.env.local` exists in the root directory
- Verify all Auth0 variables are set:
  - `AUTH0_DOMAIN`
  - `AUTH0_CLIENT_ID`
  - `AUTH0_CLIENT_SECRET`
  - `AUTH0_BASE_URL`
- Restart the backend gateway after updating `.env.local`

### "Invalid redirect_uri" error

- Check that the callback URL in Auth0 Dashboard matches exactly:
  - Should be: `http://localhost:3001/api/auth/callback`
  - Make sure `AUTH0_BASE_URL` is set to `http://localhost:3001`
- No trailing slashes!

### "Connection not found" error

- Make sure Google connection is enabled in Auth0 Dashboard
- Go to **Authentication** → **Social** → **Google** → Enable

### Backend gateway not responding

- Make sure the backend gateway is running: `npm run dev:gateway`
- Check that `GATEWAY_PORT=3001` in `.env.local`
- Verify the gateway is accessible at `http://localhost:3001/health`

### Login redirects but doesn't complete

- Check browser console for errors
- Verify `NEXT_PUBLIC_FRONTEND_URL` is set correctly
- Make sure the frontend is running on port 3000
- Check that `/auth/callback` page exists (it should be created automatically)

## 📚 Additional Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Dashboard](https://manage.auth0.com/)
- [Auth0 Community](https://community.auth0.com/)

## ✅ Verification Checklist

- [ ] Auth0 account created
- [ ] Application created (Regular Web Application)
- [ ] Domain copied to `.env.local`
- [ ] Client ID copied to `.env.local`
- [ ] Client Secret copied to `.env.local`
- [ ] Callback URL configured: `http://localhost:3001/api/auth/callback`
- [ ] Logout URL configured: `http://localhost:3000`
- [ ] Web Origins configured: `http://localhost:3000`
- [ ] Google connection enabled
- [ ] Email/Password connection enabled
- [ ] `.env.local` file created with all variables
- [ ] Backend gateway running on port 3001
- [ ] Frontend running on port 3000
- [ ] Login flow works end-to-end
