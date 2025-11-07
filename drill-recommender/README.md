# Drill Recommender Service

Flask-based service for recommending baseball drills based on swing analysis corrections.

## Features

- **Drill Database**: MongoDB-based storage for baseball drills
- **Smart Recommendations**: AI-powered drill recommendations based on swing metrics
- **Search**: Full-text search for drills by name, description, or tags
- **Correction-Based Matching**: Find drills that address specific swing issues
- **RESTful API**: Easy integration with frontend

## Setup

1. **Install Python dependencies:**
   ```bash
   cd drill-recommender
   pip install -r requirements.txt
   ```

2. **Configure MongoDB:**
   The service automatically uses the `.env.local` file from the project root.
   Make sure `MONGODB_URI` is set in the root `.env.local` file.
   
   If you need a local `.env` file, you can create one:
   ```bash
   cp .env.example .env
   ```

3. **Seed the database (optional):**
   ```bash
   npm run seed:drills
   # or
   cd drill-recommender
   python scripts/seed_drills.py
   ```

4. **Run the server:**
   ```bash
   npm run dev:drills
   # or
   cd drill-recommender
   python app.py
   ```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Drills
- `GET /api/drills` - Get all drills (with optional filters)
  - Query params: `category`, `difficulty`, `equipment`
- `GET /api/drills/<drill_id>` - Get a specific drill
- `POST /api/drills` - Create a new drill (requires auth)
- `PUT /api/drills/<drill_id>` - Update a drill (requires auth)
- `DELETE /api/drills/<drill_id>` - Delete a drill (requires auth)

### Recommendations
- `POST /api/drills/recommend` - Get drill recommendations
  - Body: `{ "corrections": [...], "metrics": {...}, "limit": 5 }`

### Search
- `GET /api/drills/search?q=query` - Search drills by text
- `POST /api/drills/search` - Advanced search
  - Body: `{ "query": "...", "corrections": [...] }`

## Integration with Main Project

The drill recommender runs on port 5001 by default. To integrate with the frontend:

1. **Set environment variable:**
   ```env
   DRILL_RECOMMENDER_URL=http://localhost:5001
   NEXT_PUBLIC_DRILL_RECOMMENDER_URL=http://localhost:5001
   ```

2. **Call from frontend:**
   ```typescript
   const response = await fetch(`${process.env.NEXT_PUBLIC_DRILL_RECOMMENDER_URL}/api/drills/recommend`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       corrections: ['low_launch_angle', 'poor_hip_rotation'],
       metrics: {
         launchAngle: 15,
         hipAngle: 10
       },
       limit: 5
     })
   });
   ```

## Drill Schema

```json
{
  "name": "Drill Name",
  "description": "Description of the drill",
  "category": "hitting",
  "difficulty": "beginner|intermediate|advanced",
  "equipment": ["bat", "tee"],
  "corrections": ["low_launch_angle", "poor_hip_rotation"],
  "instructions": ["Step 1", "Step 2"],
  "duration": 15,
  "reps": 20,
  "tags": ["tag1", "tag2"],
  "videoUrl": "https://...",
  "imageUrl": "https://..."
}
```

## Correction Types

- `low_launch_angle` - Launch angle too low (< 10°)
- `high_launch_angle` - Launch angle too high (> 35°)
- `poor_hip_rotation` - Insufficient hip rotation
- `poor_shoulder_rotation` - Insufficient shoulder rotation
- `steep_bat_path` - Bat path too steep (negative angle)
- `flat_bat_path` - Bat path too flat (> 45°)
- `poor_pose_detection` - Low confidence in pose detection

## Configuration

Set `DRILL_RECOMMENDER_PORT` in `.env` to change the port (default: 5001).

