# Backend Architecture

## Overview

The project uses a **main backend gateway** pattern where:

1. **Main Backend Gateway** (Node.js/Express) - Port 3001
   - Handles all authentication
   - Routes requests to Flask services
   - Single entry point for frontend

2. **Flask Services** (Python)
   - **Pose Detection Service** (Port 5000) - Pose detection using MediaPipe
   - **Drill Recommender** (Port 5001) - Drill recommendations
   - **Blast Connector** (Port 5002) - Blast Motion integration

## Architecture Flow

```
Frontend (Next.js)
    ↓
Main Backend Gateway (Port 3001)
    ├── Authenticates requests
    ├── Routes to Pose Detection Service (Port 5000)
    ├── Routes to Drill Recommender (Port 5001)
    └── Routes to Blast Connector (Port 5002)
```

## Main Backend Gateway

**Location**: `backend-gateway/index.ts`

**Responsibilities**:
- Firebase authentication for all requests
- Routing requests to appropriate Flask services
- Error handling and logging
- Health checks

**Endpoints**:
- `POST /api/pose/detect` → Pose Detection Service
- `POST /api/drills/recommend` → Drill Recommender
- `GET /api/drills` → Drill Recommender
- `GET /api/drills/search` → Drill Recommender
- `POST /api/blast/connect` → Blast Connector
- `POST /api/blast/data` → Blast Connector
- `GET /api/blast/sessions` → Blast Connector
- `POST /api/blast/sync/*` → Blast Connector

## Flask Services

### Test Mode

All Flask services support **test mode** for standalone testing:

```bash
# Run in test mode (bypasses authentication)
TEST_MODE=true python app.py
```

**Test Mode Features**:
- Skips Firebase authentication
- Allows requests without auth tokens
- Uses test user ID: `test_user`
- Useful for development and testing

### Running Services

**Production Mode** (through gateway):
```bash
# Start gateway
npm run dev:gateway

# Start Flask services (normal mode)
npm run dev:pose
npm run dev:drills
npm run dev:blast
```

**Test Mode** (standalone):
```bash
# Start Flask services in test mode
npm run dev:pose:test
npm run dev:drills:test
npm run dev:blast:test
```

## Frontend Integration

The frontend **only** calls the main backend gateway:

```typescript
import { getBackendUrl } from '@/lib/utils/backend-url';

// All API calls go through gateway
const response = await fetch(`${getBackendUrl()}/api/pose/detect`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
  },
  body: formData,
});
```

## Configuration

### Environment Variables

**Main Backend Gateway**:
```env
GATEWAY_PORT=3001
GATEWAY_URL=http://localhost:3001
```

**Flask Services**:
```env
# Pose Detection Service
POSE_DETECTION_SERVICE_PORT=5000
POSE_DETECTION_SERVICE_URL=http://localhost:5000

# Drill Recommender
DRILL_RECOMMENDER_PORT=5001
DRILL_RECOMMENDER_URL=http://localhost:5001

# Blast Connector
BLAST_CONNECTOR_PORT=5002
BLAST_CONNECTOR_URL=http://localhost:5002

# Test Mode (for standalone testing)
TEST_MODE=false
```

## Benefits

1. **Single Authentication Point**: All auth handled in one place
2. **Centralized Routing**: Easy to add new services
3. **Test Mode**: Flask services can run standalone for testing
4. **Frontend Simplicity**: Frontend only needs to know about gateway
5. **Service Isolation**: Flask services can be developed independently

## Development Workflow

1. **Normal Development**: Start gateway + all Flask services
2. **Service Testing**: Run individual Flask service in test mode
3. **Integration Testing**: Test through gateway with real auth

