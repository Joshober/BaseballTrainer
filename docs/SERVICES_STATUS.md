# Services Status Guide

## Overview

This application requires multiple services to be running. This guide helps you check which services are running and what needs to be started.

## Required Services

### 1. Next.js Frontend (Port 3000)
**Status:** ✅ Running (based on logs)

**To start:**
```bash
npm run dev
```

**Check if running:**
- Open `http://localhost:3000` in your browser
- Should see the application

### 2. Backend Gateway (Port 3001)
**Status:** ❌ NOT RUNNING (causing 404 errors)

**To start:**
```bash
npm run dev:gateway
```

**Check if running:**
```bash
curl http://localhost:3001/health
```

**Why it's needed:**
- Routes requests to Python services
- Handles authentication
- Required for `/api/pose/analyze-video` endpoint

### 3. Pose Detection Service (Port 5000 or 5003)
**Status:** ❓ Unknown

**To start:**
```bash
npm run dev:pose
```

**Check if running:**
```bash
curl http://localhost:5000/health
# or
curl http://localhost:5003/health
```

**Why it's needed:**
- Analyzes videos for pose detection
- Detects bat, ball, and player movements
- Required for video analysis

### 4. Blast Connector (Port 5002)
**Status:** ✅ Running (based on earlier tests)

**To start:**
```bash
npm run dev:blast
```

**Check if running:**
```bash
curl http://localhost:5002/health
```

**Why it's needed:**
- Connects to BLAST@MOTION bat sensors
- Detects swings via Bluetooth
- Required for swing detection

### 5. Drill Recommender (Port 5001)
**Status:** ❓ Unknown

**To start:**
```bash
npm run dev:drills
```

**Check if running:**
```bash
curl http://localhost:5001/health
```

**Why it's needed:**
- Provides drill recommendations
- Optional for basic functionality

## Quick Status Check

Run this command to check all services:
```bash
npm run test:swing:simple
```

Or check manually:
```bash
# Check Next.js
curl http://localhost:3000/api/health

# Check Backend Gateway
curl http://localhost:3001/health

# Check Pose Detection
curl http://localhost:5000/health

# Check Blast Connector
curl http://localhost:5002/health

# Check Drill Recommender
curl http://localhost:5001/health
```

## Common Issues

### 404 Errors on `/api/pose/analyze-video`

**Problem:** Backend gateway is not running

**Solution:**
1. Start the backend gateway:
   ```bash
   npm run dev:gateway
   ```
2. Make sure it's running on port 3001
3. Check the logs for any errors

### "Background analysis failed" Errors

**Problem:** Pose detection service is not running

**Solution:**
1. Start the pose detection service:
   ```bash
   npm run dev:pose
   ```
2. Make sure it's running on the correct port (5000 or 5003)
3. Check environment variables in `.env.local`

### Excessive Logging

**Problem:** Too many token verification logs

**Solution:**
- Logging is now reduced by default
- To enable debug logging, set `DEBUG_AUTH=true` in `.env.local`
- To disable all auth logging, remove debug logs

## Starting All Services

To start all services at once:

**Windows:**
```bash
npm run dev:all
```

**Linux/Mac:**
```bash
npm run dev:all:unix
```

Or manually start each in separate terminals:
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Backend Gateway
npm run dev:gateway

# Terminal 3: Pose Detection
npm run dev:pose

# Terminal 4: Blast Connector
npm run dev:blast

# Terminal 5: Drill Recommender (optional)
npm run dev:drills
```

## Port Summary

| Service | Port | Required |
|---------|------|----------|
| Next.js Frontend | 3000 | ✅ Yes |
| Backend Gateway | 3001 | ✅ Yes |
| Pose Detection | 5000/5003 | ✅ Yes |
| Blast Connector | 5002 | ✅ Yes (for bat) |
| Drill Recommender | 5001 | ⚠️ Optional |

## Environment Variables

Make sure your `.env.local` has:
```env
# Backend Gateway
GATEWAY_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001

# Pose Detection
POSE_DETECTION_SERVICE_URL=http://localhost:5000
POSE_DETECTION_SERVICE_PORT=5000

# Blast Connector
BLAST_CONNECTOR_PORT=5002

# Auth0
AUTH0_DOMAIN=dev-gj3i3lgvlbwjbubc.us.auth0.com
AUTH0_AUDIENCE=s25w1FNkvoNINhed0kTDj8yc86pD1Lkw
```

## Troubleshooting

1. **Check if ports are in use:**
   ```bash
   # Windows PowerShell
   netstat -an | findstr :3001
   netstat -an | findstr :5000
   
   # Linux/Mac
   lsof -i :3001
   lsof -i :5000
   ```

2. **Check service logs:**
   - Look for error messages in the terminal where services are running
   - Check for connection errors
   - Verify environment variables are set correctly

3. **Restart services:**
   - Stop all services (Ctrl+C)
   - Start them again one by one
   - Check logs for startup errors


