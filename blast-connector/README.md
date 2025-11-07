# Blast Connector Service

Flask-based service for connecting to Blast Motion sensors and integrating data into the main project.

## Features

- **Blast Motion Integration**: Connect to Blast Motion sensors and receive data
- **Data Storage**: MongoDB-based storage for Blast sensor data
- **Session Management**: Manage Blast sessions and sync with main project sessions
- **Metrics Sync**: Combine Blast metrics with pose detection results
- **Data Comparison**: Compare Blast data with pose detection for validation

## Setup

1. **Install Python dependencies:**
   ```bash
   cd blast-connector
   pip install -r requirements.txt
   ```

2. **Configure MongoDB:**
   The service automatically uses the `.env.local` file from the project root.
   Make sure `MONGODB_URI` is set in the root `.env.local` file.

3. **Configure Blast API (optional):**
   If you have a Blast API key, add it to `.env.local`:
   ```env
   BLAST_API_KEY=your_api_key
   BLAST_API_BASE_URL=https://api.blastmotion.com
   ```

4. **Run the server:**
   ```bash
   npm run dev:blast
   # or
   cd blast-connector
   python app.py
   ```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Blast Connection
- `POST /api/blast/connect` - Connect to Blast Motion device
  - Body: `{ "deviceId": "...", "apiKey": "..." }`
  - Requires auth

### Blast Data
- `POST /api/blast/data` - Receive data from Blast Motion sensor
  - Body: `{ "sessionId": "...", "data": {...} }`
  - Requires auth
- `GET /api/blast/sessions` - Get all Blast sessions for user
  - Query params: `limit`, `offset`
  - Requires auth
- `GET /api/blast/sessions/<session_id>` - Get specific Blast session
  - Requires auth
- `DELETE /api/blast/sessions/<session_id>` - Delete Blast session
  - Requires auth

### Sync
- `POST /api/blast/sync/session` - Sync Blast session with main project session
  - Body: `{ "blastSessionId": "...", "mainSessionId": "..." }`
  - Requires auth
- `POST /api/blast/sync/metrics` - Sync Blast metrics with pose detection results
  - Body: `{ "sessionId": "...", "poseMetrics": {...}, "blastMetrics": {...} }`
  - Requires auth
- `POST /api/blast/sync/compare` - Compare Blast data with pose detection
  - Body: `{ "sessionId": "..." }`
  - Requires auth

## Integration with Main Project

The Blast Connector runs on port 5002 by default. To integrate with the frontend:

1. **Set environment variable:**
   ```env
   BLAST_CONNECTOR_URL=http://localhost:5002
   NEXT_PUBLIC_BLAST_CONNECTOR_URL=http://localhost:5002
   ```

2. **Call from frontend:**
   ```typescript
   import { sendBlastData, syncBlastMetrics } from '@/lib/services/blast-connector';
   
   // Send Blast data
   await sendBlastData(sessionId, blastData, authToken);
   
   // Sync with pose detection
   await syncBlastMetrics(sessionId, poseMetrics, blastMetrics, authToken);
   ```

## Blast Data Structure

The service expects Blast data in the following format:

```json
{
  "deviceId": "device_123",
  "batSpeed": 75.5,
  "attackAngle": 12.3,
  "timeToContact": 0.15,
  "power": 85.2,
  "handSpeed": 25.3,
  "onPlane": true,
  "verticalBatAngle": 45.0,
  "connection": 0.92
}
```

## Metrics Extracted

The service automatically extracts the following metrics from Blast data:

- **batSpeed**: Bat speed in mph
- **attackAngle**: Attack angle in degrees
- **timeToContact**: Time to contact in seconds
- **power**: Power rating
- **handSpeed**: Hand speed in mph
- **onPlane**: Whether swing is on plane
- **verticalBatAngle**: Vertical bat angle in degrees
- **connection**: Connection quality (0-1)

## Database Schema

### blast_sessions
```json
{
  "_id": "ObjectId",
  "sessionId": "string",
  "userId": "string",
  "deviceId": "string",
  "mainSessionId": "string (optional)",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "syncedAt": "datetime (optional)"
}
```

### blast_data
```json
{
  "_id": "ObjectId",
  "sessionId": "string",
  "userId": "string",
  "data": "object (raw Blast data)",
  "metrics": "object (extracted metrics)",
  "createdAt": "datetime"
}
```

## Configuration

Set `BLAST_CONNECTOR_PORT` in `.env.local` to change the port (default: 5002).

