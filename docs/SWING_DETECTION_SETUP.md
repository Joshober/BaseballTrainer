# Swing Detection Setup Guide

## Quick Start

### 1. Start the Next.js Frontend

```bash
npm run dev
```

This starts the frontend on `http://localhost:3000`

### 2. Start Recording Video

1. Open `http://localhost:3000/videos` in your browser
2. Click the "Record" button
3. **Swing detection starts automatically!** The website will run the Python script in the background

### 3. Take a Swing

When you swing the bat, the system will:
- Detect the swing automatically
- Send swing data to the API
- Send stop signal to stop video recording
- The video will automatically stop

**That's it!** No manual steps needed - everything runs automatically.

## Full Workflow

### Single Terminal: Frontend
```bash
npm run dev
```

That's it! When you click "Record", swing detection starts automatically in the background.

## Manual Mode (Optional)

If you want to run swing detection manually instead of automatically:

```bash
python scripts/detect_swings.py --session-id <SESSION_ID>
```

The session ID will be shown in the browser console when you start recording.

## Troubleshooting

### Script can't find the bat
- Make sure your BLAST@MOTION sensor is powered on
- Check Bluetooth is enabled
- Run `npm run check:bat` to verify the device is discoverable

### Script can't connect to API
- Make sure Next.js is running (`npm run dev`)
- Check the API URL is correct (default: `http://localhost:3000`)
- Check the session ID matches what's in the browser console

### Video doesn't stop automatically
- Make sure the session ID matches between the script and the browser
- Check browser console for errors
- Verify the script is running and detecting swings (you'll see "SWING DETECTED!" in the terminal)

## What the Script Does

1. **Scans for BLAST@MOTION device** - Looks for your bat sensor via Bluetooth
2. **Connects to device** - Establishes BLE connection
3. **Monitors gyroscope data** - Watches for swing motion
4. **Detects swings** - Identifies when a swing occurs
5. **Sends data** - POSTs swing data to `/api/blast/swings`
6. **Stops video** - POSTs stop signal to `/api/videos/stop`

## Stopping the Script

Press `Ctrl+C` in the terminal running the script to stop swing detection.

