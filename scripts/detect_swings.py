#!/usr/bin/env python3
"""
Simple Swing Detection Script
Detects swings from BLAST@MOTION device and sends data to Next.js API
"""
import asyncio
import time
import math
import struct
import contextlib
import sys
import signal
import binascii
import argparse
import os
import requests
from collections import deque
from bleak import BleakScanner, BleakClient
from datetime import datetime

# ================== CONFIG ==================
TARGET_NAME_SUBSTR = "BLAST@MOTION"
SCAN_WINDOW_SEC = 8.0
STALL_SECS = 3.0

ACC_LSB_PER_G = 16384.0
GYRO_LSB_PER_DPS = 131.0

# Baseline permissive thresholds
FALLBACK_START_DPS = 120.0
FALLBACK_STOP_DPS = 60.0

# Quick forcing to test detection (set to True if no swings)
FORCE_THRESHOLDS = True
FORCED_START_DPS = 90.0
FORCED_STOP_DPS = 45.0

MIN_SWING_MS = 100
MAX_SWING_MS = 1500
RADIUS_M = 0.75

CALIB_SECS = 2.0

CANDIDATE_CHS = [
    "424d000a-ee44-38ce-4ebe-d1f190d70133",
    "424d000b-ee44-38ce-4ebe-d1f190d70133",
    "424d000c-ee44-38ce-4ebe-d1f190d70133",
]
POKE_ON_SUBSCRIBE = True
POKE_ON_STALL = True
START_PAYLOADS = [b"\x01", b"\x01\x00", b"START"]

# Windows asyncio quirk
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

def now():
    return time.time()

def hhmmss():
    return time.strftime("%H:%M:%S")

def unpack_i16_le(buf):
    if len(buf) % 2:
        return None
    try:
        return struct.unpack("<" + "h" * (len(buf) // 2), buf)
    except:
        return None

def unpack_i16_be(buf):
    if len(buf) % 2:
        return None
    try:
        return struct.unpack(">" + "h" * (len(buf) // 2), buf)
    except:
        return None

def try_parse(payload: bytes):
    """
    Return dict: {ax,ay,az,gx,gy,gz} in raw int16 units.
    Fallback #4 tries gyro-only at offset 6 if newer firmware shifts fields.
    """
    # 1) LE straight
    v = unpack_i16_le(payload)
    if v and len(v) >= 6:
        return {"ax": v[0], "ay": v[1], "az": v[2], "gx": v[3], "gy": v[4], "gz": v[5]}

    # 2) LE with 1-byte prefix
    if len(payload) >= 13:
        v = unpack_i16_le(payload[1:])
        if v and len(v) >= 6:
            return {"ax": v[0], "ay": v[1], "az": v[2], "gx": v[3], "gy": v[4], "gz": v[5]}

    # 3) BE straight
    v = unpack_i16_be(payload)
    if v and len(v) >= 6:
        return {"ax": v[0], "ay": v[1], "az": v[2], "gx": v[3], "gy": v[4], "gz": v[5]}

    # 4) GYRO-ONLY FALLBACK @ offset 6 (keeps swings working if acc layout changed)
    if len(payload) >= 12:
        try:
            gx, gy, gz = struct.unpack_from("<hhh", payload, 6)
            return {"ax": 0, "ay": 0, "az": 0, "gx": gx, "gy": gy, "gz": gz}
        except Exception:
            pass

    return None

# ================== Swing Detector ==================
class SwingDetector:
    def __init__(self, session_id=None, api_url="http://localhost:3000"):
        self.state = "idle"
        self.t_start = None
        self.peak = None
        self.sr_tick = deque(maxlen=50)
        self.samples = deque(maxlen=800)
        self.start_dps = FORCED_START_DPS if FORCE_THRESHOLDS else FALLBACK_START_DPS
        self.stop_dps = FORCED_STOP_DPS if FORCE_THRESHOLDS else FALLBACK_STOP_DPS
        self.session_id = session_id
        self.api_url = api_url

    def fps_tick(self, t):
        self.sr_tick.append(t)
        if len(self.sr_tick) >= 2:
            dt = self.sr_tick[-1] - self.sr_tick[0]
            if dt > 0:
                return (len(self.sr_tick) - 1) / dt
        return 0.0

    def calibrate_from(self, omegas):
        if FORCE_THRESHOLDS:
            return
        if not omegas:
            self.start_dps, self.stop_dps = FALLBACK_START_DPS, FALLBACK_STOP_DPS
            return
        mu = sum(omegas) / len(omegas)
        var = sum((w - mu) ** 2 for w in omegas) / max(1, (len(omegas) - 1))
        sd = (var ** 0.5) if var > 0 else 0.0
        if sd < 1.0 or mu > 150.0:
            self.start_dps, self.stop_dps = FALLBACK_START_DPS, FALLBACK_STOP_DPS
        else:
            self.start_dps = max(FALLBACK_START_DPS, min(500.0, mu + 8 * sd))
            self.stop_dps = max(FALLBACK_STOP_DPS, min(350.0, mu + 4 * sd))

    def feed(self, t, ax_g, ay_g, az_g, gx_dps, gy_dps, gz_dps):
        _ = self.fps_tick(t)
        omega = (gx_dps * gx_dps + gy_dps * gy_dps + gz_dps * gz_dps) ** 0.5

        # idle -> in_swing
        if self.state == "idle":
            if omega >= self.start_dps:
                self.state = "in_swing"
                self.t_start = t
                self.peak = (t, omega)
            return

        # in_swing peak tracking
        if self.peak is None or omega > self.peak[1]:
            self.peak = (t, omega)

        # swing end
        if omega <= self.stop_dps:
            dur_ms = int((t - self.t_start) * 1000)
            self.state = "idle"
            if MIN_SWING_MS <= dur_ms <= MAX_SWING_MS:
                t_peak, omega_pk = self.peak
                v_mps = (omega_pk * math.pi / 180.0) * RADIUS_M
                v_mph = v_mps * 2.23694
                attack_deg = 0.0  # placeholder

                # Console output
                print(f"SWING DETECTED! speed={v_mph:.1f} mph attack={attack_deg:.1f}° "
                      f"peakΩ={omega_pk:.1f} dps dur={dur_ms} ms")

                # Prepare swing data
                swing_data = {
                    "t_start": self.t_start,
                    "t_peak": t_peak,
                    "t_end": t,
                    "duration_ms": dur_ms,
                    "omega_peak_dps": round(omega_pk, 1),
                    "bat_speed_mph": round(v_mph, 1),
                    "attack_angle_deg": round(attack_deg, 1),
                    "timestamp": datetime.utcnow().isoformat(),
                }

                # Add sessionId if provided
                if self.session_id:
                    swing_data["sessionId"] = self.session_id

                # Send swing data to Next.js API
                try:
                    swing_url = f"{self.api_url}/api/blast/swings"
                    response = requests.post(
                        swing_url,
                        json=swing_data,
                        headers={'Content-Type': 'application/json'},
                        timeout=5.0
                    )
                    if response.status_code == 200:
                        print(f"[*] Swing data sent to Next.js successfully")
                    else:
                        print(f"[!] Failed to send swing data: {response.status_code}")
                except Exception as e:
                    print(f"[!] Error sending swing data: {e}")

                # Send stop signal to Next.js API
                if self.session_id:
                    try:
                        stop_url = f"{self.api_url}/api/videos/stop"
                        response = requests.post(
                            stop_url,
                            json={"sessionId": self.session_id},
                            headers={'Content-Type': 'application/json'},
                            timeout=5.0
                        )
                        if response.status_code == 200:
                            print(f"[*] Stop signal sent to Next.js successfully")
                        else:
                            print(f"[!] Failed to send stop signal: {response.status_code}")
                    except Exception as e:
                        print(f"[!] Error sending stop signal: {e}")

            self.peak = None

# ================== BLE helpers ==================
async def pick_device():
    devs = await BleakScanner.discover(timeout=SCAN_WINDOW_SEC)
    for d in devs:
        if getattr(d, "name", None) and TARGET_NAME_SUBSTR in d.name:
            return d
    return None

async def ensure_services(client: BleakClient):
    with contextlib.suppress(Exception):
        if hasattr(client, "get_services"):
            await client.get_services()
    return client.services

async def poke_channels(client: BleakClient, uuids, why):
    for u in uuids:
        for payload in START_PAYLOADS:
            with contextlib.suppress(Exception):
                # try no-response first (faster on many firmwares)
                try:
                    await client.write_gatt_char(u, payload, response=False)
                except Exception:
                    await client.write_gatt_char(u, payload, response=True)
            await asyncio.sleep(0.08)

async def auto_pick_channel(client: BleakClient, warmup_sec=2.0):
    await ensure_services(client)
    seen = {}
    subs = []

    def make_cb(u):
        def _cb(_h, data: bytearray):
            p = try_parse(data)
            if p:
                gx = p["gx"] / GYRO_LSB_PER_DPS
                gy = p["gy"] / GYRO_LSB_PER_DPS
                gz = p["gz"] / GYRO_LSB_PER_DPS
                omega = (gx * gx + gy * gy + gz * gz) ** 0.5
                seen.setdefault(u, []).append(omega)
        return _cb

    for cu in CANDIDATE_CHS:
        with contextlib.suppress(Exception):
            await client.start_notify(cu, make_cb(cu))
            subs.append(cu)

    if subs and POKE_ON_SUBSCRIBE:
        await poke_channels(client, subs, "auto-pick")

    t0 = now()
    while now() - t0 < warmup_sec:
        await asyncio.sleep(0.1)

    best_u = None
    best_var = -1.0
    for u, arr in seen.items():
        if len(arr) < 5:
            continue
        mu = sum(arr) / len(arr)
        var = sum((w - mu) ** 2 for w in arr) / max(1, (len(arr) - 1))
        if var > best_var:
            best_var = var
            best_u = u

    for u in list(subs):
        if u != best_u:
            with contextlib.suppress(Exception):
                await client.stop_notify(u)

    return [best_u] if best_u else subs

async def subscribe_and_run(client: BleakClient, det: SwingDetector):
    subs = await auto_pick_channel(client, warmup_sec=2.0)
    if not subs:
        for cu in CANDIDATE_CHS:
            with contextlib.suppress(Exception):
                await client.start_notify(cu, lambda *_: None)
                subs.append(cu)

    async def swap_cb(uuid):
        with contextlib.suppress(Exception):
            await client.stop_notify(uuid)

        def _cb(_h, data: bytearray):
            t = now()
            p = try_parse(data)
            if not p:
                return
            # note: acc may be zeros in the fallback; that's fine for swings
            ax = p["ax"] / ACC_LSB_PER_G
            ay = p["ay"] / ACC_LSB_PER_G
            az = p["az"] / ACC_LSB_PER_G
            gx = p["gx"] / GYRO_LSB_PER_DPS
            gy = p["gy"] / GYRO_LSB_PER_DPS
            gz = p["gz"] / GYRO_LSB_PER_DPS
            det.feed(t, ax, ay, az, gx, gy, gz)

        with contextlib.suppress(Exception):
            await client.start_notify(uuid, _cb)

    for u in list(subs):
        await swap_cb(u)

    # quick idle capture for thresholds (skipped if FORCE_THRESHOLDS=True)
    await asyncio.sleep(0.5)
    omegas = []
    for _ in range(int(CALIB_SECS * 10)):
        if det.samples:
            # samples hold last gx,gy,gz in feed; compute a quick omega
            # (we didn't store ax/ay/az here — not needed for thresholds)
            pass
        await asyncio.sleep(0.1)
    det.calibrate_from(omegas)

    if subs and POKE_ON_SUBSCRIBE:
        await poke_channels(client, subs, "post-subscribe")

    # stall detection using heartbeat ticks
    last_rx = now()
    while True:
        await asyncio.sleep(0.5)
        if det.sr_tick:
            last_rx = det.sr_tick[-1]
        if now() - last_rx >= STALL_SECS:
            if POKE_ON_STALL and subs:
                await poke_channels(client, subs, "stall")
                await asyncio.sleep(1.0)
                if det.sr_tick and now() - det.sr_tick[-1] < STALL_SECS:
                    continue
            for u in list(subs):
                with contextlib.suppress(Exception):
                    await client.stop_notify(u)
            subs = await auto_pick_channel(client, warmup_sec=1.0)
            for u in list(subs):
                await swap_cb(u)
            last_rx = now()

async def main(session_id=None, api_url="http://localhost:3000"):
    det = SwingDetector(session_id=session_id, api_url=api_url)
    stop_evt = asyncio.Event()

    def _sig(*_):
        stop_evt.set()

    for s in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            asyncio.get_running_loop().add_signal_handler(s, _sig)

    try:
        while not stop_evt.is_set():
            print("[*] Scanning for BLAST@MOTION device...")
            sys.stdout.flush()
            dev = await pick_device()
            if not dev:
                print("[*] No BLAST@MOTION found. Retrying in 3 seconds...")
                sys.stdout.flush()
                await asyncio.sleep(3)
                continue

            addr = getattr(dev, "address", None)
            name = getattr(dev, "name", "Unknown")
            print(f"[*] Found device: {name} ({addr})")
            print(f"[*] Connecting to {name} ({addr})...")
            sys.stdout.flush()

            try:
                async with BleakClient(addr, timeout=12.0) as client:
                    if not client.is_connected:
                        print("[!] Connection failed; retrying…")
                        sys.stdout.flush()
                        await asyncio.sleep(2)
                        continue
                    print("[*] Connected to BLAST@MOTION device!")
                    print("[*] Starting swing detection...")
                    print("[*] Waiting for swing...")
                    sys.stdout.flush()
                    await subscribe_and_run(client, det)
            except Exception as e:
                print(f"[!] Disconnect/error: {e}. Reconnect in 3s…")
                sys.stdout.flush()
                await asyncio.sleep(3)
    except KeyboardInterrupt:
        print("\n[*] Stopping swing detection...")
        sys.stdout.flush()
    finally:
        print("[*] Swing detection stopped")
        sys.stdout.flush()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Detect swings from BLAST@MOTION device")
    parser.add_argument("--session-id", type=str, help="Session ID for this recording")
    parser.add_argument("--api-url", type=str, default=os.getenv("NEXTJS_API_URL", "http://localhost:3000"),
                       help="Next.js API URL (default: http://localhost:3000)")
    args = parser.parse_args()

    # Print startup message immediately
    print(f"[*] Swing detection script started")
    print(f"[*] Session ID: {args.session_id}")
    print(f"[*] API URL: {args.api_url}")
    print(f"[*] Starting BLE scan for BLAST@MOTION device...")
    sys.stdout.flush()  # Ensure output is flushed immediately
    
    try:
        asyncio.run(main(session_id=args.session_id, api_url=args.api_url))
    except Exception as e:
        print(f"[!] Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

