#!/usr/bin/env python3
"""
Modified version of test.py that sends swing data to /api/swings endpoint
for Fungo Universe feature. Can be used as backup/test method.
"""

import asyncio, time, math, struct, contextlib, csv, os, sys, signal, binascii, requests
from collections import deque
from bleak import BleakScanner, BleakClient
from datetime import datetime, timezone

# ================== API CONFIG ==================
# Default to port 3000, or use NEXTJS_API_URL env var
# If your server is on a different port, set: export NEXTJS_API_URL=http://localhost:PORT
API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
SEND_TO_FUNGO_UNIVERSE = True  # Set to False to disable API calls

# ================== OUTPUT PATHS ==================
OUTPUT_DIR         = r"C:\Users\Josh\Downloads\experiment"
USE_TIMESTAMP_FILE = True
WRITE_CSV_SWINGS   = True

RUN_TS   = time.strftime("%Y%m%d-%H%M%S")
CSV_NAME = f"swings_{RUN_TS}.csv" if USE_TIMESTAMP_FILE else "swings_latest.csv"
SWING_CSV = os.path.join(OUTPUT_DIR, CSV_NAME)

# ================== CONFIG ==================
TARGET_NAME_SUBSTR   = "BLAST@MOTION"
SCAN_WINDOW_SEC      = 8.0
STALL_SECS           = 3.0

ACC_LSB_PER_G        = 16384.0
GYRO_LSB_PER_DPS     = 131.0

# Baseline permissive thresholds
FALLBACK_START_DPS   = 120.0
FALLBACK_STOP_DPS    = 60.0

# Quick forcing to test detection (set to True if no swings)
FORCE_THRESHOLDS     = True
FORCED_START_DPS     = 90.0
FORCED_STOP_DPS      = 45.0

MIN_SWING_MS         = 100
MAX_SWING_MS         = 1500
RADIUS_M             = 0.75

CALIB_SECS           = 2.0

CANDIDATE_CHS = [
    "424d000a-ee44-38ce-4ebe-d1f190d70133",
    "424d000b-ee44-38ce-4ebe-d1f190d70133",
    "424d000c-ee44-38ce-4ebe-d1f190d70133",
]
POKE_ON_SUBSCRIBE    = True
POKE_ON_STALL        = True
START_PAYLOADS       = [b"\x01", b"\x01\x00", b"START"]

# ---- Debug (set False for swing-only console output) ----
DEBUG                = False
RAW_DUMP_PER_CH      = 3       # first N frames per channel as hex
DEBUG_LINE_EVERY_S   = 1.0

# Windows asyncio quirk
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

def now(): return time.time()
def hhmmss(): return time.strftime("%H:%M:%S")

def unpack_i16_le(buf):
    if len(buf) % 2: return None
    try: return struct.unpack("<" + "h"*(len(buf)//2), buf)
    except: return None

def unpack_i16_be(buf):
    if len(buf) % 2: return None
    try: return struct.unpack(">" + "h"*(len(buf)//2), buf)
    except: return None

def try_parse(payload: bytes):
    """
    Return dict: {ax,ay,az,gx,gy,gz} in raw int16 units.
    Fallback #4 tries gyro-only at offset 6 if newer firmware shifts fields.
    """
    # 1) LE straight
    v = unpack_i16_le(payload)
    if v and len(v) >= 6:
        return {"ax":v[0],"ay":v[1],"az":v[2],"gx":v[3],"gy":v[4],"gz":v[5]}

    # 2) LE with 1-byte prefix
    if len(payload) >= 13:
        v = unpack_i16_le(payload[1:])
        if v and len(v) >= 6:
            return {"ax":v[0],"ay":v[1],"az":v[2],"gx":v[3],"gy":v[4],"gz":v[5]}

    # 3) BE straight
    v = unpack_i16_be(payload)
    if v and len(v) >= 6:
        return {"ax":v[0],"ay":v[1],"az":v[2],"gx":v[3],"gy":v[4],"gz":v[5]}

    # 4) GYRO-ONLY FALLBACK @ offset 6 (keeps swings working if acc layout changed)
    if len(payload) >= 12:
        try:
            gx, gy, gz = struct.unpack_from("<hhh", payload, 6)
            return {"ax":0,"ay":0,"az":0,"gx":gx,"gy":gy,"gz":gz}
        except Exception:
            pass

    return None

def send_swing_to_api(swing_data):
    """Send swing data to /api/swings endpoint for Fungo Universe"""
    if not SEND_TO_FUNGO_UNIVERSE:
        print(f"[*] ⚠️  Fungo Universe API disabled (SEND_TO_FUNGO_UNIVERSE=False)")
        return
    
    try:
        print(f"[*] 📡 Sending swing data to Fungo Universe API...")
        # Format data for /api/swings endpoint
        api_data = {
            "bat_speed_mph": swing_data["bat_speed_mph"],
            "attack_angle_deg": swing_data["attack_angle_deg"],
            "omega_peak_dps": swing_data["omega_peak_dps"],
            "t_start": swing_data["t_start"],
            "t_peak": swing_data["t_peak"],
            "t_end": swing_data["t_end"],
            "duration_ms": swing_data["duration_ms"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
            print(f"[*] ✅ Swing sent to Fungo Universe API successfully!")
            print(f"    🚀 Animation should trigger on /fungo-universe page")
        else:
            print(f"[!] ❌ Failed to send to Fungo Universe API: {response.status_code}")
            print(f"    Response: {response.text}")
    except requests.exceptions.ConnectionError as e:
        print(f"[!] ❌ Connection error: Could not connect to {API_URL}")
        print(f"    Make sure your Next.js server is running on that port")
        print(f"    Try: npm run dev")
        print(f"    Or set NEXTJS_API_URL environment variable to the correct URL")
    except Exception as e:
        print(f"[!] ❌ Error sending to Fungo Universe API: {e}")

# ================== Swing Detector ==================
class SwingDetector:
    def __init__(self):
        self.state="idle"
        self.t_start=None
        self.peak=None
        self.sr_tick=deque(maxlen=50)
        self.samples=deque(maxlen=800)
        self.start_dps = FORCED_START_DPS if FORCE_THRESHOLDS else FALLBACK_START_DPS
        self.stop_dps  = FORCED_STOP_DPS  if FORCE_THRESHOLDS else FALLBACK_STOP_DPS
        self.last_debug=0.0

        self.swing_writer=None
        self._swing_file=None
        if WRITE_CSV_SWINGS:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            write_header = not os.path.exists(SWING_CSV) or USE_TIMESTAMP_FILE
            self._swing_file = open(SWING_CSV, "a", newline="", encoding="utf-8")
            self.swing_writer = csv.writer(self._swing_file)
            if write_header:
                self.swing_writer.writerow([
                    "t_start","t_peak","t_end","duration_ms",
                    "omega_peak_dps","bat_speed_mph","attack_angle_deg"
                ])

    def close(self):
        if self._swing_file:
            try: self._swing_file.flush()
            except: pass
            try: self._swing_file.close()
            except: pass

    def fps_tick(self, t):
        self.sr_tick.append(t)
        if len(self.sr_tick) >= 2:
            dt = self.sr_tick[-1] - self.sr_tick[0]
            if dt > 0:
                return (len(self.sr_tick)-1) / dt
        return 0.0

    def calibrate_from(self, omegas):
        if FORCE_THRESHOLDS:
            return
        if not omegas:
            self.start_dps, self.stop_dps = FALLBACK_START_DPS, FALLBACK_STOP_DPS
            return
        mu=sum(omegas)/len(omegas)
        var=sum((w-mu)**2 for w in omegas)/max(1,(len(omegas)-1))
        sd=(var**0.5) if var>0 else 0.0
        if sd<1.0 or mu>150.0:
            self.start_dps, self.stop_dps = FALLBACK_START_DPS, FALLBACK_STOP_DPS
        else:
            self.start_dps = max(FALLBACK_START_DPS, min(500.0, mu+8*sd))
            self.stop_dps  = max(FALLBACK_STOP_DPS,  min(350.0, mu+4*sd))

    def feed(self, t, ax_g,ay_g,az_g, gx_dps,gy_dps,gz_dps):
        _ = self.fps_tick(t)
        omega=(gx_dps*gx_dps + gy_dps*gy_dps + gz_dps*gz_dps) ** 0.5

        # minimal periodic debug (optional)
        if DEBUG and (t - self.last_debug) >= DEBUG_LINE_EVERY_S:
            self.last_debug = t
            print(f"[{hhmmss()}] ω={omega:5.1f} dps | start≥{self.start_dps:.0f} stop≤{self.stop_dps:.0f} | state={self.state}")

        # idle -> in_swing
        if self.state=="idle":
            if omega>=self.start_dps:
                self.state="in_swing"; self.t_start=t; self.peak=(t,omega)
            return

        # in_swing peak tracking
        if self.peak is None or omega>self.peak[1]:
            self.peak=(t,omega)

        # swing end
        if omega<=self.stop_dps:
            dur_ms=int((t-self.t_start)*1000)
            self.state="idle"
            if MIN_SWING_MS<=dur_ms<=MAX_SWING_MS:
                t_peak,omega_pk=self.peak
                v_mps=(omega_pk*math.pi/180.0)*RADIUS_M
                v_mph=v_mps*2.23694
                attack_deg=0.0  # placeholder

                # Console: Swing detected
                print(f"\n{'='*60}")
                print(f"🎯 SWING DETECTED!")
                print(f"   Speed: {v_mph:.1f} mph")
                print(f"   Attack Angle: {attack_deg:.1f}°")
                print(f"   Peak Omega: {omega_pk:.1f} dps")
                print(f"   Duration: {dur_ms} ms")
                print(f"{'='*60}\n")

                # Prepare swing data
                swing_data = {
                    "t_start": self.t_start,
                    "t_peak": t_peak,
                    "t_end": t,
                    "duration_ms": dur_ms,
                    "omega_peak_dps": round(omega_pk, 1),
                    "bat_speed_mph": round(v_mph, 1),
                    "attack_angle_deg": round(attack_deg, 1),
                }

                # Write to CSV
                if self.swing_writer:
                    self.swing_writer.writerow([
                        self.t_start, t_peak, t, dur_ms,
                        round(omega_pk,1), round(v_mph,1), round(attack_deg,1)
                    ])
                    try: self._swing_file.flush()
                    except: pass

                # Send to Fungo Universe API
                send_swing_to_api(swing_data)

            self.peak=None

# ================== BLE helpers ==================
async def pick_device():
    devs = await BleakScanner.discover(timeout=SCAN_WINDOW_SEC)
    for d in devs:
        if getattr(d,"name",None) and TARGET_NAME_SUBSTR in d.name:
            return d
    return None

async def ensure_services(client: BleakClient):
    with contextlib.suppress(Exception):
        if hasattr(client,"get_services"): await client.get_services()
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
    seen={}; subs=[]; raw_counts={u:0 for u in CANDIDATE_CHS}

    def make_cb(u):
        def _cb(_h, data: bytearray):
            # one-time raw hex peek
            if DEBUG and raw_counts[u] < RAW_DUMP_PER_CH:
                raw_counts[u]+=1
                print(f"[{hhmmss()}] {u} raw {len(data)}b {binascii.hexlify(data).decode()[:32]}…")

            p=try_parse(data)
            if p:
                gx=p["gx"]/GYRO_LSB_PER_DPS; gy=p["gy"]/GYRO_LSB_PER_DPS; gz=p["gz"]/GYRO_LSB_PER_DPS
                omega=(gx*gx+gy*gy+gz*gz)**0.5
                seen.setdefault(u, []).append(omega)
        return _cb

    for cu in CANDIDATE_CHS:
        with contextlib.suppress(Exception):
            await client.start_notify(cu, make_cb(cu)); subs.append(cu)

    if subs and POKE_ON_SUBSCRIBE:
        await poke_channels(client, subs, "auto-pick")

    t0=now()
    while now()-t0 < warmup_sec:
        await asyncio.sleep(0.1)

    best_u=None; best_var=-1.0
    for u, arr in seen.items():
        if len(arr)<5: continue
        mu=sum(arr)/len(arr)
        var=sum((w-mu)**2 for w in arr)/max(1,(len(arr)-1))
        if var>best_var: best_var=var; best_u=u

    for u in list(subs):
        if u!=best_u:
            with contextlib.suppress(Exception): await client.stop_notify(u)

    return [best_u] if best_u else subs

async def subscribe_and_run(client: BleakClient, det: SwingDetector):
    subs = await auto_pick_channel(client, warmup_sec=2.0)
    if not subs:
        for cu in CANDIDATE_CHS:
            with contextlib.suppress(Exception):
                await client.start_notify(cu, lambda *_: None)
                subs.append(cu)

    async def swap_cb(uuid):
        with contextlib.suppress(Exception): await client.stop_notify(uuid)

        def _cb(_h, data: bytearray):
            t=now()
            p=try_parse(data)
            if not p: return
            # note: acc may be zeros in the fallback; that's fine for swings
            ax=p["ax"]/ACC_LSB_PER_G; ay=p["ay"]/ACC_LSB_PER_G; az=p["az"]/ACC_LSB_PER_G
            gx=p["gx"]/GYRO_LSB_PER_DPS; gy=p["gy"]/GYRO_LSB_PER_DPS; gz=p["gz"]/GYRO_LSB_PER_DPS
            det.feed(t, ax,ay,az, gx,gy,gz)

        with contextlib.suppress(Exception):
            await client.start_notify(uuid, _cb)

    for u in list(subs):
        await swap_cb(u)

    # quick idle capture for thresholds (skipped if FORCE_THRESHOLDS=True)
    await asyncio.sleep(0.5)
    omegas=[]
    for _ in range(int(CALIB_SECS*10)):
        if det.samples:
            # samples hold last gx,gy,gz in feed; compute a quick omega
            # (we didn't store ax/ay/az here — not needed for thresholds)
            pass
        await asyncio.sleep(0.1)
    det.calibrate_from(omegas)

    if subs and POKE_ON_SUBSCRIBE:
        await poke_channels(client, subs, "post-subscribe")

    # stall detection using heartbeat ticks
    last_rx=now()
    while True:
        await asyncio.sleep(0.5)
        if det.sr_tick: last_rx = det.sr_tick[-1]
        if now()-last_rx >= STALL_SECS:
            if DEBUG:
                print(f"[{hhmmss()}] No frames for {now()-last_rx:.1f}s — poking/resubscribing.")
            if POKE_ON_STALL and subs:
                await poke_channels(client, subs, "stall")
                await asyncio.sleep(1.0)
                if det.sr_tick and now()-det.sr_tick[-1] < STALL_SECS:
                    continue
            for u in list(subs):
                with contextlib.suppress(Exception): await client.stop_notify(u)
            subs = await auto_pick_channel(client, warmup_sec=1.0)
            for u in list(subs): await swap_cb(u)
            last_rx = now()

async def main():
    det = SwingDetector()
    stop_evt=asyncio.Event()

    def _sig(*_): stop_evt.set()
    for s in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            asyncio.get_running_loop().add_signal_handler(s, _sig)

    try:
        while not stop_evt.is_set():
            print(f"[*] 🔍 Scanning for BLAST@MOTION device...")
            dev = await pick_device()
            if not dev:
                print(f"[!] ⚠️  No BLAST@MOTION device found. Retrying in 3 seconds...")
                await asyncio.sleep(3); continue

            addr=getattr(dev,"address",None); name=getattr(dev,"name","Unknown")
            print(f"\n{'='*60}")
            print(f"🔌 Attempting to connect to {name}")
            print(f"   Address: {addr}")
            print(f"{'='*60}\n")

            try:
                async with BleakClient(addr, timeout=12.0) as client:
                    if not client.is_connected:
                        print(f"[!] ❌ Connection failed; retrying…")
                        await asyncio.sleep(2); continue
                    print(f"\n{'='*60}")
                    print(f"✅ CONNECTED to {name} ({addr})")
                    print(f"   Listening for swings...")
                    print(f"{'='*60}\n")
                    await subscribe_and_run(client, det)
            except Exception as e:
                if DEBUG: print(f"[!] Disconnect/error: {e}. Reconnect in 3s…")
                await asyncio.sleep(3)
    finally:
        det.close()

if __name__=="__main__":
    print(f"\n{'='*60}")
    print(f"🌌 Fungo Universe Swing Sender")
    print(f"{'='*60}")
    print(f"   API URL: {API_URL}")
    print(f"   Sending to Fungo Universe: {SEND_TO_FUNGO_UNIVERSE}")
    print(f"{'='*60}\n")
    asyncio.run(main())

