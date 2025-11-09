#!/usr/bin/env python3
"""
Simple script to check if BLAST@MOTION bat is connected
"""
import asyncio
import sys
from bleak import BleakScanner

TARGET_NAME_SUBSTR = "BLAST@MOTION"
SCAN_WINDOW_SEC = 5.0

async def check_bat_connection():
    """Check if BLAST@MOTION device is available"""
    print("Scanning for BLAST@MOTION device...")
    print("Make sure your bat sensor is powered on and nearby.\n")
    
    try:
        devices = await BleakScanner.discover(timeout=SCAN_WINDOW_SEC)
        
        found_devices = []
        for device in devices:
            name = getattr(device, "name", None)
            if name and TARGET_NAME_SUBSTR in name:
                found_devices.append(device)
        
        if found_devices:
            print(f"✅ Found {len(found_devices)} BLAST@MOTION device(s):")
            for i, device in enumerate(found_devices, 1):
                name = getattr(device, "name", "Unknown")
                address = getattr(device, "address", "Unknown")
                print(f"   {i}. {name} ({address})")
            print("\n✅ Bat is connected and ready!")
            return True
        else:
            print("❌ No BLAST@MOTION device found")
            print("\nTroubleshooting:")
            print("  1. Make sure your bat sensor is powered on")
            print("  2. Make sure Bluetooth is enabled on your computer")
            print("  3. Make sure the device is nearby (within range)")
            print("  4. Try turning the device off and on again")
            return False
    except Exception as e:
        print(f"❌ Error scanning for devices: {e}")
        print("\nTroubleshooting:")
        print("  1. Make sure Bluetooth is enabled")
        print("  2. Make sure you have permission to access Bluetooth")
        print("  3. On Windows, you may need to run as administrator")
        return False

if __name__ == '__main__':
    # Windows asyncio quirk
    if sys.platform.startswith("win"):
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass
    
    result = asyncio.run(check_bat_connection())
    sys.exit(0 if result else 1)


