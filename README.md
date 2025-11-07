# Baseball Swing MVP - Home Run to Mars

A Next.js application that analyzes baseball swings using AI pose detection and tracks progress through space zones from Atmosphere to Mars.

## Features

- **AI Pose Detection**: Client-side and server-side pose detection using TensorFlow.js MoveNet
- **Flexible Storage**: Support for Firebase Storage or local PC server storage
- **Flexible Database**: Support for Firebase Firestore or MongoDB Atlas
- **Space Game**: Calculate distance based on exit velocity and launch angle, track progress through space zones
- **Leaderboard**: Compete with your team and see who can launch their swing the farthest
- **Photo & Video Support**: Capture or upload photos/videos, extract best frame from videos

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS
- **AI**: TensorFlow.js, MoveNet (SinglePose Lightning)
- **Database**: Firebase Firestore or MongoDB Atlas
- **Storage**: Firebase Storage or Local PC Server
- **Auth**: Firebase Authentication
- **Server**: Express.js (optional, for local storage and pose detection)

## Prerequisites

- Node.js 18+ and npm
- Firebase project (for Firebase Auth, Firestore, Storage)
- MongoDB Atlas account (optional, if using MongoDB)
- Firebase Admin SDK credentials (for server-side operations)

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

This will automatically install and cache the AI models (~17MB). If you want to install models manually:

```bash
npm run install:models
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for server-side operations)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key

# MongoDB Atlas (if using MongoDB)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Storage & Database Toggles
STORAGE_TYPE=firebase  # or "local"
DATABASE_TYPE=firestore  # or "mongodb"

# Local Server (if STORAGE_TYPE=local)
LOCAL_SERVER_URL=http://localhost:3001
EXPRESS_SERVER_PORT=3001

# Ngrok Configuration (optional - for remote backend and/or public frontend)
# Backend via ngrok (if backend is on different PC)
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
NGROK_URL=https://baseball.ngrok.app

# Frontend via ngrok (optional - for public access)
NEXT_PUBLIC_NGROK_FRONTEND_URL=https://baseball.ngrok.dev
NGROK_FRONTEND_URL=https://baseball.ngrok.dev

# Firebase Billing Protection (prevents charges over $1)
# Note: Firebase Auth is FREE on Spark plan (50K MAU/month) - no charges!
FIREBASE_BILLING_PROTECTION=true
FIREBASE_MAX_SPEND=1.0
FIREBASE_MAX_READS_PER_DAY=40000
FIREBASE_MAX_WRITES_PER_DAY=15000
FIREBASE_MAX_STORAGE_GB=4.0
FIREBASE_MAX_BANDWIDTH_GB=0.8
```

### 3. Firebase Setup

**Quick Setup (5 minutes):**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Google** sign-in
   - Enable **Email/Password** sign-in
4. Get your Firebase config:
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps" section
   - Click Web icon (`</>`) to add web app
   - Copy the config values
5. Add config to `.env.local` (see example above)

**See `FIREBASE_SETUP.md` for detailed step-by-step instructions.**

**Optional (for Storage & Database):**
- Enable **Firestore Database** (for database)
- Enable **Storage** (for file storage)
- Set up **Security Rules** (see `FIREBASE_SETUP.md`)
- Create **Service Account** (for server-side operations)

### 4. MongoDB Atlas Setup (Optional)

1. Create a MongoDB Atlas account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string and add it to `.env.local` as `MONGODB_URI`

### 5. Firebase Security Rules

#### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: read/write own doc
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Sessions: owner can read/write; team coach can read team sessions
    match /sessions/{sessionId} {
      allow read: if request.auth != null && 
        (resource.data.uid == request.auth.uid || 
         get(/databases/$(database)/documents/teams/$(resource.data.teamId)).data.coachUid == request.auth.uid);
      allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
    
    // Leaderboards: public read per team
    match /leaderboards/{teamId}/entries/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

#### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /swings/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      // Coaches can read team images
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/teams/$(teamId)) &&
        get(/databases/$(database)/documents/teams/$(teamId)).data.coachUid == request.auth.uid;
    }
  }
}
```

### 6. Running the Application

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
│   ├── database/          # Database adapters (Firestore/MongoDB)
│   ├── storage/           # Storage adapters (Firebase/Local)
│   ├── pose/              # Pose detection (client/server)
│   ├── game/              # Game logic (physics, zones, labels)
│   ├── firebase/          # Firebase configuration
│   └── mongodb/           # MongoDB configuration
├── server/                # Express server (optional)
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## Configuration

### Storage Types

- **firebase**: Uses Firebase Storage (default)
- **local**: Uses local Express server for file storage

### Database Types

- **firestore**: Uses Firebase Firestore (default)
- **mongodb**: Uses MongoDB Atlas

Set these in `.env.local`:
```env
STORAGE_TYPE=firebase  # or "local"
DATABASE_TYPE=firestore  # or "mongodb"
```

## Usage

1. **Sign In**: Use Google or Email/Password authentication
2. **Start Mission**: Navigate to the Mission page
3. **Capture Swing**: Take a photo, upload a photo/video, or use manual mode
4. **Analyze Pose**: AI will detect your swing pose and estimate launch angle
5. **Enter Exit Velocity**: Input your exit velocity (mph)
6. **Launch**: Calculate distance and see your progress through space zones
7. **View Leaderboard**: See how you rank against your team

## Game Logic

### Distance Calculation

```
distanceFt = (exitVelocity^2 / 32.174) * sin(2 * launchAngleRadians)
```

### Space Zones

- **Atmosphere**: 0-300 ft
- **Low Earth Orbit**: 300-1,000 ft
- **Moon**: 1,000-6,000 ft
- **Mars**: 6,000-35,000 ft
- **Beyond**: 35,000+ ft

### Swing Classification

- **Good**: Launch angle 25°-35° AND exit velocity ≥ 90 mph
- **Needs Work**: Otherwise

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
- See `MODEL_INSTALLATION.md` for detailed instructions

### Firebase Auth Errors

- **"Firebase: Error (auth/invalid-api-key)"**:
  - Check that `.env.local` has correct `NEXT_PUBLIC_FIREBASE_API_KEY`
  - Make sure API key starts with `AIzaSy`
  - Restart dev server after adding config
- **"Firebase Auth is disabled"**:
  - Check that all `NEXT_PUBLIC_FIREBASE_*` variables are set in `.env.local`
  - Make sure values don't have quotes
  - See `FIREBASE_SETUP.md` for complete setup guide
- **Google Sign-In not working**:
  - Make sure Google sign-in is enabled in Firebase Console
  - Check that support email is selected
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
