"""
Helper module for sending swing data to Fungo Universe API
Can be imported into your existing swing detection scripts
"""

import requests
import os
from datetime import datetime
from typing import Dict, Optional

# Configuration
API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
ENABLED = os.getenv("FUNGO_UNIVERSE_ENABLED", "true").lower() == "true"


def send_swing_to_fungo_universe(swing_data: Dict) -> bool:
    """
    Send swing data to /api/swings endpoint for Fungo Universe feature.
    
    Args:
        swing_data: Dictionary with keys:
            - bat_speed_mph: float
            - attack_angle_deg: float
            - omega_peak_dps: float
            - t_start: float (timestamp)
            - t_peak: float (timestamp)
            - t_end: float (timestamp)
            - duration_ms: int
    
    Returns:
        True if successful, False otherwise
    """
    if not ENABLED:
        return False
    
    try:
        # Format data for /api/swings endpoint
        api_data = {
            "bat_speed_mph": swing_data.get("bat_speed_mph", 0.0),
            "attack_angle_deg": swing_data.get("attack_angle_deg", 0.0),
            "omega_peak_dps": swing_data.get("omega_peak_dps", 0.0),
            "t_start": swing_data.get("t_start"),
            "t_peak": swing_data.get("t_peak"),
            "t_end": swing_data.get("t_end"),
            "duration_ms": swing_data.get("duration_ms", 0),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        response = requests.post(
            f"{API_URL}/api/swings",
            json=api_data,
            headers={
                "Content-Type": "application/json",
            },
            timeout=5.0
        )
        
        if response.status_code == 200:
            print(f"[*] Swing sent to Fungo Universe successfully")
            return True
        else:
            print(f"[!] Failed to send to Fungo Universe API: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"[!] Error sending to Fungo Universe API: {e}")
        return False


# Example usage in your swing detector:
"""
from scripts.fungo_universe_api import send_swing_to_fungo_universe

# In your SwingDetector.feed() method, after detecting a swing:
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
"""

