# Swing Detection Testing Guide

## Quick Start (Windows)

### Option 1: Start All Services in Separate Windows (Recommended)
```powershell
npm run dev:all
```
**This is the easiest way!** It opens separate PowerShell windows for each service:
- Backend Gateway (port 3001)
- Blast Connector (port 5002) 
- Next.js Frontend (port 3000)
- Pose Detection (port 5000) - optional
- Drill Recommender (port 5001) - optional

Each service runs in its own window, making it easy to see logs and stop individual services.

### Option 2: Start All Services in One Terminal
```powershell
npm run start:dev
```
This runs all required services (Gateway, Blast Connector, Frontend) in one terminal with colored output.

**For all services including optional ones:**
```powershell
npm run start:dev:full
```

### Option 3: Start Services Manually (For Debugging)

Open **5 separate terminals** and run:

**Terminal 1: Backend Gateway** (Required)
```powershell
npm run dev:gateway
```
Should show: `Backend Gateway listening on port 3001`

**Terminal 2: Blast Connector** (Required for Swing Detection)
```powershell
npm run dev:blast
```
Should show: `Starting Blast Connector on port 5002`

**Terminal 3: Next.js Frontend** (Required)
```powershell
npm run dev
```
Should show: `Ready on http://localhost:3000`

**Terminal 4: Pose Detection** (Optional - only needed for video analysis)
```powershell
npm run dev:pose
```

**Terminal 5: Drill Recommender** (Optional)
```powershell
npm run dev:drills
```

## Testing Swing Detection

### Prerequisites
1. ✅ All required services are running (Gateway, Blast Connector, Next.js)
2. ✅ BLAST@MOTION device is powered on and nearby
3. ✅ Bluetooth is enabled on your computer

### Step-by-Step Test

1. **Open the app in your browser:**
   ```
   http://localhost:3000
   ```

2. **Navigate to Videos page:**
   - Click on "Videos" in the navigation
   - Or go directly to: `http://localhost:3000/videos`

3. **Start Recording:**
   - Click the "Record" button
   - You should see:
     - **In the browser**: A status box showing "Swing Detection: Connecting..."
     - **In the browser console**:
       ```
       ✅ Swing detection started automatically: {session_id: "...", status: "running"}
       ```

4. **Check Swing Detection Status:**
   - **In the browser UI**, you'll see a status box with:
     - **Yellow indicator** + "Connecting..." - Scanning for bat
     - **Green indicator** + "Connected" - Bat connected successfully
     - **Red indicator** + "Connection Failed" - Connection failed (with Retry button)
   - **Status messages**:
     - "Scanning for BLAST@MOTION device... Make sure your bat is powered on."
     - "✓ Swing detection active. Video will stop automatically when a swing is detected."
     - "Failed to connect to swing detection. Click 'Retry Connection' to try again."

5. **Check Flask Service Logs:**
   - Look at the **Blast Connector terminal** (Terminal 2)
   - You should see:
     ```
     [Swing Detection] Started for session: <session-id>
     [*] Scanning for BLAST@MOTION device...
     ```

6. **Connect the Bat:**
   - Make sure your BLAST@MOTION device is powered on
   - The Flask service will automatically scan and connect
   - You should see in **Blast Connector logs**:
     ```
     [*] Found device: BLAST@MOTION (...)
     [*] Connecting to BLAST@MOTION device...
     [*] Connected to BLAST@MOTION device!
     [*] Starting swing detection...
     [*] Waiting for swing...
     ```
   - **In the browser UI**, status should change to "Connected" (green)

7. **If Connection Fails - Use Retry Button:**
   - If you see "Connection Failed" (red indicator):
     - Click the **"Retry Connection"** button
     - The button will show "Retrying..." with a spinning icon
     - Status will change to "Connecting..." then "Connected" if successful
   - This is useful if:
     - The bat wasn't powered on when recording started
     - Bluetooth connection was interrupted
     - Flask service had a temporary issue

8. **Take a Swing:**
   - Swing the bat normally
   - When a swing is detected, you should see in **Blast Connector logs**:
     ```
     SWING DETECTED! speed=XX.X mph attack=0.0° peakΩ=XXX.X dps dur=XXX ms
     [*] Swing data sent to Next.js successfully
     [*] Stop signal sent to Next.js successfully
     ```
   - The video recording should **automatically stop**

9. **Verify in Browser:**
   - Check the **browser console** for:
     ```
     Stop signal received, stopping recording
     ```
   - The video should stop and show a preview
   - The swing detection status will reset to "Idle"

## Troubleshooting

### Swing Detection Not Starting

**Check Browser UI:**
- Look for the swing detection status box when recording
- If it shows "Connection Failed" (red), click "Retry Connection" button
- Status should show "Connecting..." then "Connected"

**Check Browser Console:**
- Look for errors when clicking "Record"
- Should see: `✅ Swing detection started automatically`
- If you see errors, check the error message

**Check Flask Service:**
- Make sure Blast Connector is running on port 5002
- Check for errors in the terminal
- Should see: `[Swing Detection] Started for session: ...`

**Check Backend Gateway:**
- Make sure Gateway is running on port 3001
- The frontend calls Gateway, which proxies to Flask service
- Restart gateway if you see 404 errors

### Bat Not Connecting

**Use the Retry Button:**
- If status shows "Connection Failed", click "Retry Connection"
- Make sure bat is powered on before retrying
- The retry button will:
  1. Stop the current detection attempt
  2. Wait 500ms
  3. Start a new detection attempt
  4. Show "Retrying..." while working

**Check Flask Service Logs:**
- Should see: `[*] Scanning for BLAST@MOTION device...`
- If you see: `[*] No BLAST@MOTION found. Retrying in 3 seconds...`
  - Make sure the bat is powered on
  - Make sure Bluetooth is enabled
  - Try moving the bat closer to your computer
  - Click "Retry Connection" button in the browser

**Check Bluetooth:**
- Windows: Settings > Devices > Bluetooth & other devices
- Make sure Bluetooth is enabled
- Make sure no other app is connected to the bat
- Try turning Bluetooth off and on again

**Status Indicators:**
- **Yellow "Connecting..."** - Normal, scanning for bat
- **Green "Connected"** - Success! Bat is connected
- **Red "Connection Failed"** - Error, use Retry button

### Swing Detected But Video Doesn't Stop

**Check Flask Service Logs:**
- Should see: `[*] Stop signal sent to Next.js successfully`
- If you see an error, check the Next.js server logs

**Check Browser Console:**
- Should see polling requests: `GET /api/videos/stop?sessionId=...`
- Should see: `Stop signal received, stopping recording`

**Check Next.js Server:**
- Look for: `🛑 STOP SIGNAL received for session: ...`
- Look for: `✅ SWING DETECTED! Session: ...`

**Check Status in Browser:**
- Status should show "Connected" (green) when bat is connected
- If status shows "Connection Failed", swing detection won't work

## API Endpoints

### Flask Service (Blast Connector)
- `POST http://localhost:5002/api/blast/swing-detection/start` - Start detection
- `POST http://localhost:5002/api/blast/swing-detection/stop` - Stop detection
- `GET http://localhost:5002/api/blast/swing-detection/status?sessionId=...` - Get status
- `POST http://localhost:5002/api/blast/swings` - Receive swing data

### Next.js API
- `POST http://localhost:3000/api/blast/swings` - Receive swing data
- `POST http://localhost:3000/api/videos/stop` - Receive stop signal
- `GET http://localhost:3000/api/videos/stop?sessionId=...` - Check stop signal
- `GET http://localhost:3000/api/blast/swings?sessionId=...` - Check swing data

### Backend Gateway (Proxies to Flask)
- `POST http://localhost:3001/api/blast/swing-detection/start` - Start detection
- `POST http://localhost:3001/api/blast/swing-detection/stop` - Stop detection
- `GET http://localhost:3001/api/blast/swing-detection/status?sessionId=...` - Get status

## Manual Testing

### Test Flask Service Directly

```powershell
# Start swing detection
curl -X POST http://localhost:5002/api/blast/swing-detection/start `
  -H "Content-Type: application/json" `
  -d '{"sessionId": "test-session-123"}'

# Check status
curl http://localhost:5002/api/blast/swing-detection/status?sessionId=test-session-123

# Stop swing detection
curl -X POST http://localhost:5002/api/blast/swing-detection/stop `
  -H "Content-Type: application/json" `
  -d '{"sessionId": "test-session-123"}'
```

### Test via Backend Gateway

```powershell
# Start swing detection (requires auth token)
curl -X POST http://localhost:3001/api/blast/swing-detection/start `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{"sessionId": "test-session-123"}'
```

## Expected Flow

1. **User clicks "Record"** → Next.js calls Flask service to start detection
2. **Flask service** → Scans for BLAST@MOTION device
3. **Flask service** → Connects to device and starts monitoring
4. **User swings bat** → Flask service detects swing
5. **Flask service** → Sends swing data to Next.js
6. **Flask service** → Sends stop signal to Next.js
7. **Next.js polling** → Detects stop signal
8. **Next.js** → Stops video recording automatically

## Log Locations

- **Browser Console**: Frontend logs, API calls, errors
- **Next.js Terminal**: Server-side logs, API route logs
- **Backend Gateway Terminal**: Gateway logs, proxy logs
- **Blast Connector Terminal**: Swing detection logs, BLE connection logs

## Success Indicators

✅ **Swing Detection Started:**
- **Browser UI**: Status shows "Connecting..." (yellow indicator)
- Browser console: `✅ Swing detection started automatically`
- Flask logs: `[Swing Detection] Started for session: ...`

✅ **Bat Connected:**
- **Browser UI**: Status changes to "Connected" (green indicator)
- **Browser UI**: Message shows "✓ Swing detection active. Video will stop automatically when a swing is detected."
- Flask logs: `[*] Connected to BLAST@MOTION device!`

✅ **Swing Detected:**
- Flask logs: `SWING DETECTED! speed=XX.X mph`
- Flask logs: `[*] Swing data sent to Next.js successfully`
- Flask logs: `[*] Stop signal sent to Next.js successfully`

✅ **Video Stopped:**
- Browser console: `Stop signal received, stopping recording`
- Next.js logs: `🛑 STOP SIGNAL received for session: ...`
- Video recording stops automatically
- Status resets to "Idle"

## New Features

### Swing Detection Status Display
- **Real-time status** shown in the recording UI
- **Color-coded indicators**:
  - 🟡 Yellow: Connecting/Scanning
  - 🟢 Green: Connected
  - 🔴 Red: Connection Failed
- **Helpful messages** for each state
- **Automatic updates** as connection status changes

### Retry Connection Button
- **Appears automatically** when connection fails
- **One-click retry** - stops and restarts detection
- **Visual feedback** - spinning icon while retrying
- **Prevents multiple attempts** - button disabled during retry
- **Useful when**:
  - Bat wasn't powered on initially
  - Bluetooth connection interrupted
  - Temporary service issues

### How to Use Retry
1. Start recording (click "Record" button)
2. If status shows "Connection Failed" (red):
   - Make sure your BLAST@MOTION bat is powered on
   - Click the "Retry Connection" button
   - Wait for status to change to "Connected" (green)
3. If still failing:
   - Check Bluetooth is enabled
   - Check Flask service is running
   - Check bat is nearby and powered on
   - Try retry button again

