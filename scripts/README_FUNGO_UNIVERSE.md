# Fungo Universe - Swing Detection Setup

## Overview

The Fungo Universe feature requires swing data to be sent to `/api/swings` endpoint. You can use either:

1. **Python BLE Script** - Detects swings from BLAST@MOTION device and sends to API
2. **Test Script** - Sends mock swing data for testing without a device

## Setup

### Environment Variables

Set these in your `.env.local` or environment:

```bash
NEXTJS_API_URL=http://localhost:3000
BLAST_SECRET=super-secret-string
```

### Option 1: Using Python BLE Script (Real Device)

Use the modified script that sends to Fungo Universe:

```bash
python scripts/fungo-universe-swing-sender.py
```

Or modify your existing `C:\Users\Josh\Downloads\experiment\test.py` to add the API call (see below).

### Option 2: Using Test Script (No Device Required)

For testing without a BLE device:

```bash
# Test all planet ranges
python scripts/test-fungo-universe.py

# Send a specific swing
python scripts/test-fungo-universe.py 75.5 12.0 150.0
# Arguments: [speed_mph] [attack_angle_deg] [omega_peak_dps]
```

## Adding API Call to Your Existing Script

To add Fungo Universe API calls to your existing `test.py`, add this function and call it when a swing is detected:

```python
import requests
from datetime import datetime

API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
BLAST_SECRET = os.getenv("BLAST_SECRET", "super-secret-string")

def send_swing_to_fungo_universe(swing_data):
    """Send swing data to /api/swings endpoint"""
    try:
        api_data = {
            "bat_speed_mph": swing_data["bat_speed_mph"],
            "attack_angle_deg": swing_data["attack_angle_deg"],
            "omega_peak_dps": swing_data["omega_peak_dps"],
            "t_start": swing_data["t_start"],
            "t_peak": swing_data["t_peak"],
            "t_end": swing_data["t_end"],
            "duration_ms": swing_data["duration_ms"],
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        response = requests.post(
            f"{API_URL}/api/swings",
            json=api_data,
            headers={
                "Content-Type": "application/json",
                "x-blast-secret": BLAST_SECRET,
            },
            timeout=5.0
        )
        
        if response.status_code == 200:
            print(f"[*] Swing sent to Fungo Universe successfully")
        else:
            print(f"[!] Failed to send: {response.status_code}")
    except Exception as e:
        print(f"[!] Error: {e}")
```

Then call it in your `SwingDetector.feed()` method after detecting a swing:

```python
# After detecting a swing, add:
swing_data = {
    "t_start": self.t_start,
    "t_peak": t_peak,
    "t_end": t,
    "duration_ms": dur_ms,
    "omega_peak_dps": round(omega_pk, 1),
    "bat_speed_mph": round(v_mph, 1),
    "attack_angle_deg": round(attack_deg, 1),
}
send_swing_to_fungo_universe(swing_data)
```

## Testing

1. Start your Next.js dev server: `npm run dev`
2. Open `/fungo-universe` page in your browser
3. Run one of the Python scripts above
4. When a swing is detected, you should see:
   - Camera fly-through animation to the selected planet
   - Google Street View opening at the calculated location

## Planet Mapping

Swing speed determines which planet you land on:

- 0-20 mph: Mercury
- 20-40 mph: Venus
- 40-60 mph: Earth
- 60-80 mph: Mars
- 80-100 mph: Jupiter
- 100-120 mph: Saturn
- 120-140 mph: Uranus
- 140+ mph: Neptune

