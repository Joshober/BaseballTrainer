# Baseball Swing MVP

A Next.js application that analyzes baseball swings using AI pose detection and provides personalized coaching feedback to improve your swing.

## Features

- **AI Pose Detection**: Client-side (TensorFlow.js) and server-side (MediaPipe) pose detection
- **Storage**: Local PC server storage
- **Database**: MongoDB Atlas
- **AI Coaching**: Get instant feedback from AI coaches on your swing mechanics
- **Drill Recommendations**: Receive personalized drill suggestions based on your analysis
- **Photo & Video Support**: Capture or upload photos/videos, extract best frame from videos

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS
- **AI**: TensorFlow.js, MoveNet (SinglePose Lightning)
- **Database**: MongoDB Atlas
- **Storage**: Local PC Server
- **Auth**: Auth0 Authentication
- **Backend**: Main Gateway (Node.js) + Flask Services (Python)
  - Pose Detection Service (MediaPipe)
  - Drill Recommender Service
  - Blast Connector Service

## Prerequisites

- Node.js 18+ and npm
- Auth0 account (for authentication)
- MongoDB Atlas account (for database)

## Setup Instructions

### 1. Clone and Install

**Quick Install (Recommended):**
```bash
npm run install:all
```

This will install:
- Node.js dependencies
- Python dependencies for all Flask services (pose-detection-service, drill-recommender, blast-connector)
- AI models (~17MB)

**Manual Install:**
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for all services
npm run install:python

# Or install individually:
npm run install:python:pose      # Pose Detection Service
npm run install:python:drills    # Drill Recommender
npm run install:python:blast     # Blast Connector

# Install AI models (optional - will download on first use)
npm run install:models
```

**Note:** Make sure you have Python 3.8+ and pip installed. The install script will automatically detect your Python installation.

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Auth0 Configuration
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_BASE_URL=http://localhost:3001
AUTH0_AUDIENCE=your_api_identifier
AUTH0_SCOPE=openid profile email

# MongoDB Atlas
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
# Or specify database separately:
MONGODB_DATABASE=baseball

# Storage & Database Toggles
STORAGE_TYPE=local
DATABASE_TYPE=mongodb

# Backend Gateway Configuration
GATEWAY_PORT=3001
GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001  # For frontend

# Flask Services Configuration
POSE_DETECTION_SERVICE_PORT=5000
POSE_DETECTION_SERVICE_URL=http://localhost:5000
DRILL_RECOMMENDER_PORT=5001
DRILL_RECOMMENDER_URL=http://localhost:5001
BLAST_CONNECTOR_PORT=5002
BLAST_CONNECTOR_URL=http://localhost:5002

# Demo Mode (for Flask services - allows independent testing with demo user)
DEMO_MODE=false
DEMO_USER_ID=demo_user

# Test Mode (for Flask services - bypasses authentication)
TEST_MODE=false

# Ngrok Configuration (optional - for remote backend and/or public frontend)
# Backend via ngrok (if backend is on different PC)
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
NGROK_URL=https://baseball.ngrok.app

# Frontend via ngrok (optional - for public access)
NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev
NGROK_FRONTEND_URL=https://baseball.ngrok.dev

```

### 3. Auth0 Setup

**Quick Setup (5 minutes):**

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new application (Regular Web Application)
3. Configure callback URLs:
   - Allowed Callback URLs: `http://localhost:3001/api/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
4. Get your Auth0 credentials:
   - Domain: Found at the top of your Auth0 Dashboard
   - Client ID: Found in your Application settings
   - Client Secret: Click "Show" in Application settings
5. Add config to `.env.local` (see example above)

**See `docs/AUTH0_SETUP.md` for detailed step-by-step instructions.**

### 4. MongoDB Atlas Setup

1. Create a MongoDB Atlas account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string and add it to `.env.local` as `MONGODB_URI`

### 5. Running the Application

#### Development Mode

```bash
# Start Next.js dev server
npm run dev

# (Optional) Start Express server for local storage
npm run dev:server
```

The Next.js app will run on [http://localhost:3000](http://localhost:3000)
The Express server will run on [http://localhost:3001](http://localhost:3001) (if started)

#### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
baseballhackathon/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── mission/           # Mission page
│   ├── leaderboard/       # Leaderboard page
│   └── login/             # Login page
├── components/            # React components
│   ├── Auth/              # Authentication components
│   ├── Mission/           # Mission flow components
│   └── Leaderboard/       # Leaderboard components
├── lib/                   # Core libraries
│   ├── database/          # Database adapters (MongoDB)
│   ├── storage/           # Storage adapters (Local)
│   ├── pose/              # Pose detection (client/server)
│   ├── game/              # Game logic (physics, zones, labels)
│   ├── auth0/             # Auth0 configuration
│   └── mongodb/           # MongoDB configuration
├── pose-detection-service/  # Pose detection service (MediaPipe)
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## Configuration

### Storage Types

- **local**: Uses local Python backend for file storage (default)

### Database Types

- **mongodb**: Uses MongoDB Atlas (default)

Set these in `.env.local`:
```env
STORAGE_TYPE=local
DATABASE_TYPE=mongodb
```

## Usage

1. **Sign In**: Use Google OAuth authentication via Auth0
2. **Upload Video**: Upload a video of your swing from the Analyze or Blast Off page
3. **Get Analysis**: AI will analyze your swing using pose detection and object tracking
4. **Review Metrics**: See detailed metrics including bat speed, exit velocity, launch angle, and biomechanics
5. **Get Coaching**: Receive AI-powered coaching feedback with specific recommendations
6. **View Drills**: Get personalized drill recommendations to improve your swing
7. **Track Progress**: View all your videos and analyses in your video library

## Analysis Features

### Video Analysis

- **Pose Detection**: MediaPipe-based pose detection with 33 body landmarks
- **Object Detection**: YOLOv8-based detection of person, bat, and ball
- **Metrics Calculation**: Bat speed, exit velocity, launch angle, and more
- **Swing Phases**: Automatic detection of load, stride, contact, and follow-through phases
- **Biomechanics**: Analysis of hip rotation, shoulder separation, weight transfer, and more
- **Form Errors**: Identification of common swing flaws with recommendations

### AI Coaching

- **OpenRouter Integration**: Get instant coaching feedback from Claude 3.5 Sonnet
- **Gemini Integration**: Receive personalized drill recommendations based on your analysis
- **Voice Over**: Listen to coaching feedback with ElevenLabs text-to-speech

## API Routes

- `POST /api/pose` - Server-side pose detection
- `POST /api/storage/upload` - Upload file to local storage
- `GET /api/storage/:path` - Get file from local storage
- `POST /api/sessions` - Create a session
- `GET /api/sessions` - Get user sessions

## Express Server Routes

- `POST /api/pose/detect` - Pose detection endpoint
- `POST /api/storage/upload` - File upload
- `GET /api/storage/:path` - File serving
- `DELETE /api/storage/:path` - File deletion

## Troubleshooting

### Pose Detection Not Working

- Ensure TensorFlow.js models are loaded (check browser console)
- Run `npm run install:models` to pre-download and cache models
- Verify image has clear pose visibility
- Try server-side detection if client-side fails

### Models Not Loading

- Run `npm run install:models` to install models manually
- Check your internet connection (models download from Google CDN)
- Models are cached after first download (~17MB total)
- See `docs/MODEL_INSTALLATION.md` for detailed instructions

### Auth0 Errors

- **"Auth0 not configured"**:
  - Check that `.env.local` has all `AUTH0_*` variables set
  - Make sure `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` are set
  - Restart dev server after adding config
- **"Invalid token" errors**:
  - Check that callback URLs are configured in Auth0 Dashboard
  - Ensure `AUTH0_BASE_URL` matches your backend gateway URL
  - Verify `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` are set correctly
  - See `docs/AUTH0_SETUP.md` for complete setup guide
- **Google Sign-In not working**:
  - Make sure Google sign-in is enabled in Auth0 Dashboard
  - Check that callback URLs are configured correctly
  - Try clearing browser cache

### MongoDB Connection Issues

- Verify connection string format
- Check IP whitelist in MongoDB Atlas
- Ensure database user has proper permissions

### Local Storage Not Working

- Ensure Express server is running (`npm run dev:server`)
- Check `LOCAL_SERVER_URL` in `.env.local`
- Verify `server/uploads/` directory exists and is writable

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
