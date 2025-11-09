# How to Add Fungo Universe API to Your Existing test.py

## Quick Method: Import Helper Module

Add these lines at the top of your `test.py`:

```python
# Add after other imports
import sys
import os
# Add the scripts directory to path so we can import the helper
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from fungo_universe_api import send_swing_to_fungo_universe
```

Then in your `SwingDetector.feed()` method, after detecting a swing (around line 198), add:

```python
# After the CSV write section (around line 197), add:
                # Send to Fungo Universe API
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

## Alternative: Direct Implementation

If you prefer not to use the helper module, add this function to your `test.py`:

```python
import requests
from datetime import datetime

# Add at top with other config
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

Then call it in your swing detection code (same location as above).

## Exact Location in Your Code

In your `test.py`, find this section (around line 191-198):

```python
                if self.swing_writer:
                    self.swing_writer.writerow([
                        self.t_start, t_peak, t, dur_ms,
                        round(omega_pk,1), round(v_mph,1), round(attack_deg,1)
                    ])
                    try: self._swing_file.flush()
                    except: pass
            self.peak=None
```

Add the API call right after the CSV write, before `self.peak=None`:

```python
                if self.swing_writer:
                    self.swing_writer.writerow([
                        self.t_start, t_peak, t, dur_ms,
                        round(omega_pk,1), round(v_mph,1), round(attack_deg,1)
                    ])
                    try: self._swing_file.flush()
                    except: pass
                
                # Send to Fungo Universe API
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
            self.peak=None
```

## Environment Variables

Make sure you have these set (in `.env.local` or environment):

```bash
NEXTJS_API_URL=http://localhost:3000
BLAST_SECRET=super-secret-string
```

Or set them before running:

```bash
export NEXTJS_API_URL=http://localhost:3000
export BLAST_SECRET=super-secret-string
python C:\Users\Josh\Downloads\experiment\test.py
```

