# Ngrok Setup Guide

This guide explains how to set up ngrok to:
1. **Run backend server and AI models on a different PC** (optional)
2. **Run frontend publicly via ngrok** (optional)
3. **Run everything locally** (default, no ngrok needed)

You can use ngrok for just the backend, just the frontend, or both - it's completely optional!

## 🎯 **Setup Overview**

- **Backend PC**: Runs Express server + AI models (port 3001)
- **Frontend PC**: Runs Next.js frontend only (port 3000)
- **Ngrok**: Creates secure tunnel from backend PC to frontend PC

## 📋 **Prerequisites**

1. **Ngrok Premium Account** (you have this ✅)
2. **Ngrok installed** on the PC(s) where you want to use it
3. **Optional**: Two PCs if you want backend on a different machine

## 🔧 **Step 1: Configure ngrok.yml**

The `ngrok.yml` file is already configured with your credentials for both backend and frontend:

```yaml
version: 3
agent:
  authtoken: 33iaELUMFFFvmbxODvOPZdb9gtm_6ZgRzTW3LcbG1shh2J5hN
endpoints:
  # Backend server (Express + AI models) - port 3001
  - name: baseball-backend
    url: baseball.ngrok.app
    upstream:
      url: http://localhost:3001
  
  # Frontend (Next.js) - port 3000
  - name: baseball-frontend
    url: baseball.ngrok.dev
    upstream:
      url: http://localhost:3000
```

**Note**: 
- Backend endpoint points to port 3001 (Express server)
- Frontend endpoint points to port 3000 (Next.js server)
- You can use either or both endpoints independently

## 🚀 **Step 2: Start Backend Server (Backend PC)**

On the backend PC, start the Express server:

```bash
npm run dev:server
```

This will start the server on `http://localhost:3001`.

## 🌐 **Step 3: Start Ngrok Tunnel (Backend PC)**

On the backend PC, start ngrok:

**Windows (PowerShell):**
```powershell
.\scripts\start-ngrok.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/start-ngrok.sh
./scripts/start-ngrok.sh
```

**Or manually:**
```bash
ngrok start baseball-backend --config ngrok.yml
```

Ngrok will create a tunnel at `https://baseball.ngrok.app` pointing to your local Express server.

## 💻 **Step 4: Configure Frontend (Frontend PC)**

On the frontend PC, create or update `.env.local`:

### **If using backend via ngrok:**
```env
# Ngrok Backend URL (use your ngrok domain)
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app

# Or use NGROK_URL for server-side
NGROK_URL=https://baseball.ngrok.app
```

### **If using frontend via ngrok (optional):**
```env
# Ngrok Frontend URL (for public access)
NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev
NGROK_FRONTEND_URL=https://baseball.ngrok.dev
```

### **Complete example:**
```env
# Backend via ngrok
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
NGROK_URL=https://baseball.ngrok.app

# Frontend via ngrok (optional)
NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev

# Other configs...
STORAGE_TYPE=local
DATABASE_TYPE=mongodb
# ... rest of your config
```

**Important**: 
- Use `NEXT_PUBLIC_BACKEND_URL` for client-side access to backend
- Use `NEXT_PUBLIC_NGROK_FRONTEND_URL` if you want to display the public URL in the UI
- All `NEXT_PUBLIC_*` variables are available in the browser

## 🎨 **Step 5: Start Frontend (Frontend PC)**

On the frontend PC, start the Next.js app:

```bash
npm run dev
```

### **If you want public access via ngrok:**

In another terminal, start ngrok for the frontend:

```bash
npm run dev:ngrok:frontend
# or
ngrok start baseball-frontend --config ngrok.yml
```

Your app will be accessible at:
- **Local**: `http://localhost:3000`
- **Public (via ngrok)**: `https://baseball.ngrok.dev`

The frontend will automatically connect to the backend via ngrok if `NEXT_PUBLIC_BACKEND_URL` is set.

## ✅ **Verification**

### **Backend via Ngrok:**
1. **Check ngrok status**: Visit `http://localhost:4040` on the backend PC to see ngrok dashboard
2. **Test backend**: Visit `https://baseball.ngrok.app/health` - should return `{"status":"ok"}`
3. **Test frontend**: Visit `http://localhost:3000` - should connect to backend via ngrok

### **Frontend via Ngrok:**
1. **Check ngrok status**: Visit `http://localhost:4040` on the frontend PC to see ngrok dashboard
2. **Test frontend**: Visit `https://baseball.ngrok.dev` - should show your Next.js app
3. **Test backend connection**: The frontend should still connect to backend via ngrok if configured

## 🔄 **How It Works**

### **Client-Side (Browser)**
- Frontend calls `https://baseball.ngrok.app/api/pose/detect` (Express server via ngrok)
- Ngrok tunnels the request to `http://localhost:3001` on the backend PC
- Backend processes the request and returns response via ngrok

### **Server-Side (Next.js API Routes)**
- Next.js API routes can also use `NGROK_URL` to call the backend
- Useful for server-side operations that need backend access

## 📝 **Environment Variables**

### **Backend PC** (`.env.local`)
```env
# Express server config
EXPRESS_SERVER_PORT=3001

# Auth0 (for auth verification)
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_AUDIENCE=your_api_identifier

# Database & Storage
DATABASE_TYPE=mongodb
STORAGE_TYPE=local
```

### **Frontend PC** (`.env.local`)
```env
# Ngrok Backend URL (if backend is on different PC)
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
NGROK_URL=https://baseball.ngrok.app

# Ngrok Frontend URL (optional - for public access)
NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev
NGROK_FRONTEND_URL=https://baseball.ngrok.dev

# Auth0 Client Config
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id
# ... rest of Auth0 config

# Database & Storage
DATABASE_TYPE=mongodb
STORAGE_TYPE=local  # Will use ngrok backend if NEXT_PUBLIC_BACKEND_URL is set
```

## 🛠️ **Troubleshooting**

### **Connection Refused**
- Make sure Express server is running on backend PC (port 3001)
- Check ngrok is running: `ngrok status`
- Verify ngrok config: `ngrok config check`

### **CORS Errors**
- Express server already has CORS enabled
- Make sure ngrok URL is correct in frontend `.env.local`

### **Auth Errors**
- Make sure Auth0 is configured on backend PC
- Verify auth tokens are being passed correctly

### **404 Not Found**
- Check ngrok endpoint name matches config: `baseball-backend`
- Verify upstream URL: `http://localhost:3001`
- Check Express server routes: `/api/pose/detect`, `/api/storage/upload`

## 🔒 **Security Notes**

1. **Ngrok Config**: The `ngrok.yml` file contains your auth token. Keep it secure and don't commit it to git (already in `.gitignore`).

2. **HTTPS**: Ngrok provides HTTPS automatically, so all traffic is encrypted.

3. **Auth**: All backend endpoints require Auth0 auth tokens, so unauthorized access is prevented.

4. **Premium Benefits**: With ngrok premium, you get:
   - Custom domain (`baseball.ngrok.app`)
   - No connection limits
   - Better performance

## 📊 **Architecture Diagrams**

### **Option 1: Backend via Ngrok (Backend on Different PC)**
```
┌─────────────────┐         ┌──────────┐         ┌─────────────────┐
│  Frontend PC    │         │  Ngrok   │         │  Backend PC     │
│  (localhost)    │────────▶│  Tunnel  │────────▶│  (localhost)    │
│                 │         │          │         │                 │
│  Next.js        │         │  HTTPS   │         │  Express Server │
│  Port 3000      │         │  Tunnel  │         │  Port 3001      │
│                 │         │          │         │                 │
│  - Frontend UI  │         │          │         │  - AI Models     │
│  - API Routes   │         │          │         │  - File Storage  │
└─────────────────┘         └──────────┘         └─────────────────┘
                            baseball.ngrok.app
```

### **Option 2: Frontend via Ngrok (Public Access)**
```
┌─────────────────┐         ┌──────────┐
│  Internet       │────────▶│  Ngrok   │────────▶┌─────────────────┐
│  Users          │         │  Tunnel  │         │  Frontend PC    │
│                 │         │          │         │  (localhost)    │
│                 │         │  HTTPS   │         │                 │
│                 │         │  Tunnel  │         │  Next.js        │
│                 │         │          │         │  Port 3000      │
└─────────────────┘         └──────────┘         └─────────────────┘
                            baseball.ngrok.dev
```

### **Option 3: Both Backend and Frontend via Ngrok**
```
┌─────────────────┐         ┌──────────┐         ┌─────────────────┐
│  Internet       │────────▶│  Ngrok   │────────▶│  Frontend PC    │
│  Users          │         │  Tunnel  │         │                 │
│                 │         │          │         │  Next.js        │
│                 │         │  HTTPS   │         │  Port 3000      │
│                 │         │  Tunnel  │         │                 │
│                 │         │          │         │  ┌─────────────┐ │
│                 │         │          │         │  │  Backend    │ │
│                 │         │          │────────▶│  │  via Ngrok  │ │
│                 │         │          │         │  └─────────────┘ │
└─────────────────┘         └──────────┘         └─────────────────┘
                            baseball.ngrok.dev    ┌─────────────────┐
                                                  │  Backend PC     │
                                                  │  Express Server │
                                                  │  Port 3001      │
                                                  └─────────────────┘
                                                  baseball.ngrok.app
```

## 🎯 **Quick Start Commands**

### **Option 1: Backend via Ngrok (Backend on Different PC)**

**Backend PC:**
```bash
# 1. Start Express server
npm run dev:server

# 2. Start ngrok for backend (in another terminal)
npm run dev:ngrok:backend
# or
ngrok start baseball-backend --config ngrok.yml
```

**Frontend PC:**
```bash
# 1. Set environment variable
# Add to .env.local: NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app

# 2. Start Next.js
npm run dev
```

### **Option 2: Frontend via Ngrok (Public Access)**

**Frontend PC:**
```bash
# 1. Start Next.js
npm run dev

# 2. Start ngrok for frontend (in another terminal)
npm run dev:ngrok:frontend
# or
ngrok start baseball-frontend --config ngrok.yml
```

**Access your app at:** `https://baseball.ngrok.dev`

### **Option 3: Both Backend and Frontend via Ngrok**

**Backend PC:**
```bash
# 1. Start Express server
npm run dev:server

# 2. Start ngrok for backend
npm run dev:ngrok:backend
```

**Frontend PC:**
```bash
# 1. Set environment variable
# Add to .env.local: 
# NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
# NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev

# 2. Start Next.js
npm run dev

# 3. Start ngrok for frontend (in another terminal)
npm run dev:ngrok:frontend
```

**Access your app at:** `https://baseball.ngrok.dev`

### **Option 4: Everything Local (No Ngrok)**

**Single PC:**
```bash
# 1. Start Express server
npm run dev:server

# 2. Start Next.js (in another terminal)
npm run dev
```

**Access your app at:** `http://localhost:3000`

That's it! Choose the option that works best for you. 🚀

