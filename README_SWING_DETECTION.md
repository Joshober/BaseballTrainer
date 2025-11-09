# How to Run Swing Detection

## Quick Start

### Step 1: Start the Frontend
```bash
npm run dev
```

### Step 2: Start Recording
1. Go to `http://localhost:3000/videos`
2. Click "Record"
3. **Swing detection starts automatically!** No manual steps needed.

## What Happens

1. **Frontend** starts recording video
2. **Swing detection automatically starts** in the background (runs the Python script)
3. **Swing detection script** connects to your BLAST@MOTION bat sensor
4. When you **swing the bat**, the script detects it
5. **Video automatically stops** when swing is detected

## Manual Mode (Optional)

If you prefer to run swing detection manually:

```bash
# After starting recording, copy the session ID from console, then:
python scripts/detect_swings.py --session-id <SESSION_ID>
```

## Troubleshooting

- **Can't find bat?** Run `npm run check:bat` to verify device is discoverable
- **Video doesn't stop?** Make sure the session ID matches between browser and script
- **Script errors?** Make sure Next.js is running and the API URL is correct

For more details, see `docs/SWING_DETECTION_SETUP.md`

