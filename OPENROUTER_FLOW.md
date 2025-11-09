# OpenRouter Call Flow - Files Involved

## Complete File List for OpenRouter Video Analysis

### 1. Frontend Entry Point
**File:** `app/train/page.tsx`
- **Lines 37-110**: `handleVideoSelect` function
- **Line 83**: Calls `/api/openrouter/analyze-video`
- **Lines 17, 39, 101**: Manages `openRouterFeedback` state
- **Lines 174-191**: Displays feedback in UI

### 2. Main OpenRouter API Route
**File:** `app/api/openrouter/analyze-video/route.ts`
- **Purpose**: Main orchestrator for OpenRouter analysis
- **Key Functions**:
  - Authenticates user (lines 15-25)
  - Gets session from database (lines 35-44)
  - Reads video file from filesystem (lines 51-107)
  - Calls frame extraction service (lines 109-167)
  - Sends frames to OpenRouter API (lines 189-218)
  - Returns feedback (lines 229-238)

### 3. Authentication
**File:** `lib/auth0/admin.ts`
- **Function**: `verifyIdToken` (line 35)
- **Purpose**: Verifies Auth0 JWT tokens
- **Used by**: OpenRouter API route (line 22)

### 4. Database Operations
**File:** `lib/mongodb/operations.ts`
- **Function**: `getSession` (line ~100)
- **Purpose**: Retrieves session data from MongoDB
- **Used by**: OpenRouter API route (line 36)

### 5. Configuration
**File:** `lib/utils/config.ts`
- **Lines 47-51**: OpenRouter configuration
  - `apiKey`: From `OPENROUTER_API_KEY` env var
  - `apiUrl`: `https://openrouter.ai/api/v1/chat/completions`
- **Used by**: OpenRouter API route (lines 182, 190, 193)

### 6. Backend URL Utility
**File:** `lib/utils/backend-url.ts`
- **Function**: `getBackendUrl()` (line 5)
- **Purpose**: Gets gateway URL (defaults to `http://localhost:3001`)
- **Used by**: OpenRouter API route (line 111)

### 7. Backend Gateway (Express Server)
**File:** `backend-gateway/index.ts`
- **Lines 469-511**: `/api/pose/extract-frames` endpoint
- **Purpose**: Proxies frame extraction requests to Python service
- **Key Functions**:
  - Authenticates request (line 470: `authenticate` middleware)
  - Receives video file via multer (line 470: `upload.single('video')`)
  - Forwards to pose-detection-service (lines 489-502)

### 8. Pose Detection Service (Python Flask)
**File:** `pose-detection-service/routes/pose.py`
- **Lines 163-259**: `/api/pose/extract-frames` endpoint
- **Purpose**: Extracts frames from video using OpenCV
- **Key Functions**:
  - Receives video file (line 174)
  - Saves to temp file (lines 188-193)
  - Opens with OpenCV (line 196)
  - Extracts frames every Nth frame (lines 208-232)
  - Converts to base64 JPEG (lines 215-229)
  - Returns frames array (lines 236-241)

### 9. Storage Operations
**File:** `lib/storage/local-adapter.ts`
- **Lines 5-44**: `uploadFile` method
- **Purpose**: Uploads video to storage
- **Used by**: Train page (line 54)

### 10. Session Creation
**File:** `app/api/sessions/route.ts` (implied)
- **Purpose**: Creates session in database
- **Used by**: Train page (lines 57-74)

## Data Flow

```
1. User uploads video
   └─> app/train/page.tsx (handleVideoSelect)
       │
2. Video uploaded to storage
   └─> lib/storage/local-adapter.ts (uploadFile)
       │
3. Session created in database
   └─> app/api/sessions/route.ts
       │
4. OpenRouter API called
   └─> app/api/openrouter/analyze-video/route.ts
       │
5. Authenticate user
   └─> lib/auth0/admin.ts (verifyIdToken)
       │
6. Get session from database
   └─> lib/mongodb/operations.ts (getSession)
       │
7. Read video file from filesystem
   └─> app/api/openrouter/analyze-video/route.ts (lines 51-107)
       │
8. Send video to gateway for frame extraction
   └─> backend-gateway/index.ts (/api/pose/extract-frames)
       │
9. Gateway forwards to Python service
   └─> pose-detection-service/routes/pose.py (extract_frames)
       │
10. Frames extracted and returned
    └─> app/api/openrouter/analyze-video/route.ts (lines 169-179)
        │
11. Send frames to OpenRouter API
    └─> app/api/openrouter/analyze-video/route.ts (lines 189-218)
        │
12. Return feedback to frontend
    └─> app/train/page.tsx (display feedback)
```

## Environment Variables Required

- `OPENROUTER_API_KEY`: OpenRouter API key
- `AUTH0_DOMAIN`: Auth0 domain for authentication
- `MONGODB_URI`: MongoDB connection string
- `GATEWAY_URL` (optional): Backend gateway URL (defaults to `http://localhost:3001`)

## External API Calls

1. **OpenRouter API**: `https://openrouter.ai/api/v1/chat/completions`
   - Model: `openai/gpt-4o`
   - Requires: API key in Authorization header
   - Sends: Base64-encoded video frames

2. **Auth0 JWKS**: `https://{AUTH0_DOMAIN}/.well-known/jwks.json`
   - Used for token verification

## Key Dependencies

- **Node.js**: File API, FormData, fetch
- **OpenCV** (Python): Video frame extraction
- **PIL/Pillow** (Python): Image processing
- **MongoDB**: Session storage
- **Auth0**: User authentication

