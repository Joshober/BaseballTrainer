# Demo Mode - Independent Service Testing

## Overview

Demo mode allows each Flask service to run independently with a demo user, enabling you to test and develop each service separately without needing the full backend gateway setup.

## How It Works

When `DEMO_MODE=true` is set:
- Services accept requests from anywhere (not just the gateway)
- All authenticated endpoints use a demo user
- No Firebase authentication required
- Perfect for independent testing and development

## Enabling Demo Mode

### Option 1: Environment Variable

Add to your `.env.local`:
```env
DEMO_MODE=true
DEMO_USER_ID=demo_user  # Optional: customize demo user ID
```

### Option 2: Command Line

Run services with demo mode:
```bash
# Pose Detection Service
npm run dev:pose:demo

# Drill Recommender
npm run dev:drills:demo

# Blast Connector
npm run dev:blast:demo
```

Or manually:
```bash
# Pose Detection Service
cd pose-detection-service
DEMO_MODE=true python app.py

# Drill Recommender
cd drill-recommender
DEMO_MODE=true python app.py

# Blast Connector
cd blast-connector
DEMO_MODE=true python app.py
```

## Demo User

When demo mode is enabled, all authenticated endpoints use a demo user:

```python
request.user = {
    'uid': 'demo_user',  # or DEMO_USER_ID if set
    'source': 'demo',
    'email': 'demo_user@demo.local',
    'name': 'Demo User'
}
```

## Testing Services Independently

### Pose Detection Service (Port 5000)

```bash
# Start in demo mode
npm run dev:pose:demo

# Test endpoint
curl -X POST http://localhost:5000/api/pose/detect \
  -F "image=@path/to/image.jpg"
```

### Drill Recommender (Port 5001)

```bash
# Start in demo mode
npm run dev:drills:demo

# Test endpoints
curl http://localhost:5001/api/drills
curl http://localhost:5001/api/drills/search?q=swing
curl -X POST http://localhost:5001/api/drills/recommend \
  -H "Content-Type: application/json" \
  -d '{"corrections": ["shoulder angle"], "limit": 5}'
```

### Blast Connector (Port 5002)

```bash
# Start in demo mode
npm run dev:blast:demo

# Test endpoints
curl http://localhost:5002/api/blast/sessions
curl -X POST http://localhost:5002/api/blast/data \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test123", "data": {"batSpeed": 75}}'
```

## Demo Mode vs Test Mode vs Production Mode

### Demo Mode (`DEMO_MODE=true`)
- ✅ Accepts requests from anywhere
- ✅ Uses demo user for all authenticated endpoints
- ✅ Perfect for independent service testing
- ✅ No gateway required

### Test Mode (`TEST_MODE=true`)
- ✅ Accepts requests from anywhere
- ✅ Uses test user for all authenticated endpoints
- ✅ Similar to demo mode (legacy support)

### Production Mode (default)
- ✅ Only accepts requests from backend gateway
- ✅ Uses real user IDs from gateway
- ✅ Requires gateway authentication

## Example: Testing Pose Detection Service

1. **Start service in demo mode:**
   ```bash
   npm run dev:pose:demo
   ```

2. **Test with curl:**
   ```bash
   curl -X POST http://localhost:5000/api/pose/detect \
     -F "image=@test-image.jpg"
   ```

3. **Test with Postman:**
   - Method: POST
   - URL: `http://localhost:5000/api/pose/detect`
   - Body: form-data
   - Key: `image` (type: File)
   - Value: Select an image file

4. **Test with Python:**
   ```python
   import requests

   url = "http://localhost:5000/api/pose/detect"
   files = {"image": open("test-image.jpg", "rb")}
   response = requests.post(url, files=files)
   print(response.json())
   ```

## Example: Testing Drill Recommender

1. **Start service in demo mode:**
   ```bash
   npm run dev:drills:demo
   ```

2. **Seed drills (optional):**
   ```bash
   npm run seed:drills
   ```

3. **Test endpoints:**
   ```bash
   # Get all drills
   curl http://localhost:5001/api/drills

   # Search drills
   curl http://localhost:5001/api/drills/search?q=swing

   # Get recommendations
   curl -X POST http://localhost:5001/api/drills/recommend \
     -H "Content-Type: application/json" \
     -d '{
       "corrections": ["shoulder angle", "hip rotation"],
       "metrics": {"launchAngle": 15},
       "limit": 5
     }'
   ```

## Benefits

1. **Independent Development**: Test each service without running the entire stack
2. **Faster Iteration**: No need to set up gateway and authentication
3. **Easier Debugging**: Isolate issues to specific services
4. **API Testing**: Test endpoints directly with tools like Postman or curl
5. **Service-Specific Features**: Develop and test features for individual services

## Security Note

⚠️ **Demo mode should only be used for development and testing!**

- Never enable demo mode in production
- Demo mode accepts requests from anywhere
- No authentication is performed
- All requests use the demo user

## Switching Between Modes

To switch from demo mode to production mode:

1. **Stop the service**
2. **Remove or set `DEMO_MODE=false` in `.env.local`**
3. **Restart the service** (it will now require gateway requests)

Or use the production command:
```bash
npm run dev:pose      # Production mode (requires gateway)
npm run dev:pose:demo  # Demo mode (independent)
```

