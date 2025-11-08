# Postman Testing Guide - Claude Video Analysis Endpoint

## Service Status
- **Service**: Pose Detection Service
- **Port**: 5000
- **Mode**: TEST_MODE (authentication bypassed)

## Endpoints to Test

### 1. Health Check
**GET** `http://localhost:5000/health`

**Headers**: None required

**Expected Response**:
```json
{
  "status": "ok",
  "service": "python-backend",
  "version": "1.0.0"
}
```

---

### 2. Claude Video Analysis
**POST** `http://localhost:5000/api/pose/analyze-video-claude`

**Headers**:
```
Content-Type: application/json
X-Internal-Request: true
X-User-Id: test_user
```

**Body** (JSON):
```json
{
  "video_id": "your_video.mp4"
}
```

**Expected Response** (Success):
```json
{
  "ok": true,
  "recommendation": "Your swing shows good hip rotation but could benefit from...",
  "frameCount": 15,
  "framesAnalyzed": 15
}
```

**Expected Response** (Video Not Found):
```json
{
  "error": "Video not found in storage server",
  "ok": false
}
```

**Expected Response** (Missing video_id):
```json
{
  "error": "video_id is required",
  "ok": false
}
```

---

## Postman Setup

### Collection Setup:
1. Create a new collection: "Baseball Trainer - Pose Detection"
2. Set base URL variable: `base_url = http://localhost:5000`

### Request 1: Health Check
- **Method**: GET
- **URL**: `{{base_url}}/health`
- **Headers**: None

### Request 2: Claude Analysis
- **Method**: POST
- **URL**: `{{base_url}}/api/pose/analyze-video-claude`
- **Headers**:
  - `Content-Type`: `application/json`
  - `X-Internal-Request`: `true`
  - `X-User-Id`: `test_user` (or your actual user ID)
- **Body** (raw JSON):
  ```json
  {
    "video_id": "test_video.mp4"
  }
  ```

---

## Testing Notes

1. **For Real Testing**: 
   - You need a video uploaded to storage-server at path `{user_id}/{video_id}`
   - Make sure storage-server is running on port 5003
   - Update `X-User-Id` header to match the user who uploaded the video

2. **OpenRouter API Key**:
   - Must be set in `.env.local` as `OPENROUTER_API_KEY`
   - Without it, the endpoint will return an error

3. **Test Mode**:
   - Service is running with `TEST_MODE=true`
   - Authentication is bypassed
   - `X-User-Id` header is still required for video path construction

---

## Example Test Flow

1. **Check Health**: GET `/health` → Should return `{"status": "ok"}`
2. **Test with Invalid Video**: POST with non-existent `video_id` → Should return 404
3. **Test with Valid Video**: POST with actual video from storage-server → Should return analysis

---

## Troubleshooting

- **Connection Refused**: Service not running → Check port 5000
- **500 Error**: Check service logs for OpenRouter API key or dependency issues
- **404 Error**: Video doesn't exist in storage-server at `{user_id}/{video_id}` path


