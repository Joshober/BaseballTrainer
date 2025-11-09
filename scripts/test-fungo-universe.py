#!/usr/bin/env python3
"""
Test script for Fungo Universe - sends swing data to /api/swings endpoint
Can be used as a backup/test method when BLE device is not available
"""

import requests
import time
import os
from datetime import datetime

# Configuration
API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")

def send_swing_data(bat_speed_mph, attack_angle_deg=0.0, omega_peak_dps=150.0):
    """Send swing data to the /api/swings endpoint"""
    swing_data = {
        "bat_speed_mph": bat_speed_mph,
        "attack_angle_deg": attack_angle_deg,
        "omega_peak_dps": omega_peak_dps,
        "t_start": time.time() - 0.5,
        "t_peak": time.time() - 0.25,
        "t_end": time.time(),
        "duration_ms": 500,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    try:
        response = requests.post(
            f"{API_URL}/api/swings",
            json=swing_data,
            headers={
                "Content-Type": "application/json",
            },
            timeout=5.0
        )
        
        if response.status_code == 200:
            print(f"✅ Swing sent successfully: {bat_speed_mph:.1f} mph")
            return True
        else:
            print(f"❌ Failed to send swing: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error sending swing: {e}")
        return False

def test_planet_range():
    """Test swings across different planet ranges"""
    print("Testing Fungo Universe with different swing speeds...\n")
    
    # Test each planet range
    test_swings = [
        (15, "Mercury (0-20 mph)"),
        (30, "Venus (20-40 mph)"),
        (50, "Earth (40-60 mph)"),
        (70, "Mars (60-80 mph)"),
        (90, "Jupiter (80-100 mph)"),
        (110, "Saturn (100-120 mph)"),
        (130, "Uranus (120-140 mph)"),
        (150, "Neptune (140+ mph)"),
    ]
    
    for speed, planet in test_swings:
        print(f"\nSending swing for {planet}...")
        send_swing_data(speed, attack_angle_deg=10.0, omega_peak_dps=speed * 1.5)
        time.sleep(2)  # Wait 2 seconds between swings

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Manual swing speed provided
        try:
            speed = float(sys.argv[1])
            attack = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
            omega = float(sys.argv[3]) if len(sys.argv) > 3 else speed * 1.5
            print(f"Sending test swing: {speed} mph, {attack}° attack, {omega} dps")
            send_swing_data(speed, attack, omega)
        except ValueError:
            print("Usage: python test-fungo-universe.py [speed] [attack_angle] [omega_peak]")
            print("Example: python test-fungo-universe.py 75.5 12.0 150.0")
    else:
        # Run full test suite
        test_planet_range()

