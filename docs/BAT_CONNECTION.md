# Bat Connection Guide

## Overview

The swing detection system uses BLE (Bluetooth Low Energy) to connect to BLAST@MOTION bat sensors. Swing detection is handled by a simple standalone Python script.

## What Needs to Be Running

### 1. Next.js Frontend
The frontend handles video recording and receives swing data.

**To start it:**
```bash
npm run dev
```

The frontend runs on port **3000** by default.

### 2. Swing Detection Script (Python)
**YES, you need to run the Python script!**

The swing detection is handled by a simple standalone script that:
- Scans for BLAST@MOTION devices via Bluetooth
- Connects to the bat sensor
- Detects swings and sends data to Next.js
- Sends stop signal to stop video recording

**To start it:**
```bash
# When recording video, the console will show the session ID
# Then run:
python scripts/detect_swings.py --session-id <SESSION_ID>
```

Or set the API URL:
```bash
python scripts/detect_swings.py --session-id <SESSION_ID> --api-url http://localhost:3000
```

## How to Use

### Recording with Swing Detection

1. Start the Next.js frontend: `npm run dev`
2. Go to `http://localhost:3000/videos`
3. Click "Record" to start video recording
4. The console will show a session ID (e.g., `Recording started. Session ID: abc-123-def`)
5. Run the swing detection script with that session ID:
   ```bash
   python scripts/detect_swings.py --session-id abc-123-def
   ```
6. When a swing is detected, the video will automatically stop

### Option 1: Command Line Script
Run the bat connection checker:
```bash
npm run check:bat
```

Or manually:
```bash
python scripts/check-bat-connection.py
```

This will scan for BLAST@MOTION devices and tell you if one is found.

### Option 2: Check Script Output
The swing detection script will print connection status:
- `[*] Connecting to BLAST@MOTION...` - Found device, connecting
- `[*] Connected. Starting swing detection...` - Connected and ready
- `[*] No BLAST@MOTION found. Retrying…` - Device not found

## Connection Status Indicators

### ✅ Connected (Green)
- Bat sensor is powered on
- Bluetooth connection established
- Swing detection is active
- Ready to record videos with automatic swing detection

### ❌ Not Connected (Gray)
- No BLAST@MOTION device found
- Device may be powered off
- Device may be out of range
- Bluetooth may be disabled

## Troubleshooting

### Bat Not Found

1. **Check Device Power**
   - Make sure your BLAST@MOTION sensor is powered on
   - Check battery level
   - Try turning it off and on again

2. **Check Bluetooth**
   - Make sure Bluetooth is enabled on your computer
   - On Windows, you may need to run as administrator
   - Check if other Bluetooth devices work

3. **Check Distance**
   - Make sure the device is nearby (within Bluetooth range)
   - Try moving closer to the device

4. **Check Service Status**
   - Make sure `blast-connector` service is running
   - Check logs for connection errors
   - Try restarting the service

5. **Check Permissions**
   - On Windows, you may need admin privileges
   - On macOS/Linux, check Bluetooth permissions

### Service Not Running

If the blast-connector service is not running:

1. **Start the service:**
   ```bash
   npm run dev:blast
   ```

2. **Check if port 5002 is available:**
   ```bash
   # Windows PowerShell
   netstat -an | findstr :5002
   
   # Linux/Mac
   lsof -i :5002
   ```

3. **Check logs for errors:**
   - Look for error messages in the terminal
   - Check if `bleak` library is installed
   - Check if Python version is compatible

## How It Works

1. **Start Swing Detection:**
   - When you click "Start Detection" or start recording a video
   - The service scans for BLAST@MOTION devices
   - If found, it connects via BLE

2. **Monitor for Swings:**
   - The service continuously reads gyroscope data
   - When a swing is detected, it sends data to Next.js
   - Recording automatically stops when swing data is received

3. **Connection Status:**
   - Status is checked every 5 seconds
   - Green indicator means bat is connected
   - Gray indicator means no bat found

## Quick Start Checklist

- [ ] Blast Connector service is running (`npm run dev:blast`)
- [ ] Next.js frontend is running (`npm run dev`)
- [ ] BLAST@MOTION sensor is powered on
- [ ] Bluetooth is enabled on your computer
- [ ] Device is nearby (within range)
- [ ] Check status at `http://localhost:3000/blast`

## Testing Connection

Run the test script to verify everything is working:
```bash
npm run test:swing:simple
```

This will check:
- ✅ Blast Connector service is running
- ✅ Next.js frontend is running
- ✅ Services can communicate

## Need Help?

If you're still having issues:
1. Check the logs in the terminal where `blast-connector` is running
2. Try restarting both services
3. Make sure all dependencies are installed (`npm run install:python:blast`)
4. Check that `bleak` library is installed (`pip list | grep bleak`)

