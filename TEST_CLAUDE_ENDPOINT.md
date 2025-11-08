# Testing Claude Video Analysis Endpoint

## Prerequisites

1. **Install Dependencies**:
   ```bash
   cd pose-detection-service
   pip install -r requirements.txt
   ```

2. **Set Environment Variables** in `.env.local`:
   ```env
   OPENROUTER_API_KEY=your_api_key_here
   STORAGE_SERVER_URL=http://localhost:5003
   ```

3. **Start Storage Server** (if testing with real videos):
   ```bash
   cd storage-server
   python app.py
   ```

## Starting the Service

### Test Mode (bypasses authentication):
```bash
cd pose-detection-service
TEST_MODE=true python app.py
```

### Normal Mode (requires backend gateway):
```bash
npm run dev:pose
```

## Testing the Endpoint

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Test Claude Endpoint (Test Mode)

**Note**: You need a video uploaded to storage-server first at path `{user_id}/{video_id}`

```bash
curl -X POST http://localhost:5000/api/pose/analyze-video-claude \
  -H "Content-Type: application/json" \
  -H "X-Internal-Request: true" \
  -H "X-User-Id: test_user" \
  -d '{"video_id": "your_video.mp4"}'
```

### 3. Test via Backend Gateway (Normal Mode)

```bash
# First, get an auth token from Auth0, then:
curl -X POST http://localhost:3001/api/pose/analyze-video-claude \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"video_id": "your_video.mp4"}'
```

## Expected Response

```json
{
  "ok": true,
  "recommendation": "Your swing shows good hip rotation but could benefit from...",
  "frameCount": 15,
  "framesAnalyzed": 15
}
```

## Troubleshooting

- **ModuleNotFoundError**: Run `pip install -r requirements.txt` in pose-detection-service
- **Video not found**: Make sure video exists in storage-server at `{user_id}/{video_id}`
- **OpenRouter API errors**: Check your API key in `.env.local`
- **Service not starting**: Check for port conflicts (port 5000)


