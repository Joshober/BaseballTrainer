"""
Swing Detection Service for BLAST@MOTION device
Runs swing detection in the background and sends data to Next.js when detected
Based on scripts/detect_swings.py
"""
import asyncio
import time
import math
import struct
import contextlib
import sys
import signal
import os
import requests
import threading
from collections import deque
from bleak import BleakScanner, BleakClient
from datetime import datetime
from typing import Dict, Optional, Callable
import logging

logger = logging.getLogger(__name__)

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
    """Return dict: {ax,ay,az,gx,gy,gz} in raw int16 units."""
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

    # 4) GYRO-ONLY FALLBACK @ offset 6
    if len(payload) >= 12:
        try:
            gx, gy, gz = struct.unpack_from("<hhh", payload, 6)
            return {"ax": 0, "ay": 0, "az": 0, "gx": gx, "gy": gy, "gz": gz}
        except Exception:
            pass

    return None

async def pick_device():
    """Scan for BLAST@MOTION device"""
    try:
        devs = await BleakScanner.discover(timeout=SCAN_WINDOW_SEC)
        for d in devs:
            if getattr(d, "name", None) and TARGET_NAME_SUBSTR in d.name:
                return d
    except Exception as e:
        logger.error(f"Error scanning for device: {e}")
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

class SwingDetector:
    """Detects swings from gyroscope data"""
    
    def __init__(self, session_id: str, api_url: str, on_swing_detected: Callable):
        self.session_id = session_id
        self.api_url = api_url
        self.on_swing_detected = on_swing_detected
        self.state = "idle"
        self.t_start = None
        self.peak = None
        self.sr_tick = deque(maxlen=50)
        self.samples = deque(maxlen=800)
        self.start_dps = FORCED_START_DPS if FORCE_THRESHOLDS else FALLBACK_START_DPS
        self.stop_dps = FORCED_STOP_DPS if FORCE_THRESHOLDS else FALLBACK_STOP_DPS

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

                logger.info(f"SWING DETECTED! speed={v_mph:.1f} mph attack={attack_deg:.1f}° "
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
                    "sessionId": self.session_id,
                }

                # Call callback
                self.on_swing_detected(swing_data)

            self.peak = None

async def subscribe_and_run(client: BleakClient, det: SwingDetector, stop_evt: asyncio.Event):
    """Subscribe to BLE characteristics and run swing detection"""
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
            pass
        await asyncio.sleep(0.1)
    det.calibrate_from(omegas)

    if subs and POKE_ON_SUBSCRIBE:
        await poke_channels(client, subs, "post-subscribe")

    # stall detection using heartbeat ticks
    last_rx = now()
    while not stop_evt.is_set():
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
        
        # Check if client is still connected
        if not client.is_connected:
            logger.warning("[!] Client disconnected, breaking loop")
            break

class SwingDetectionService:
    """Service for managing swing detection sessions"""
    
    def __init__(self, nextjs_api_url: str = None):
        self.nextjs_api_url = nextjs_api_url or os.getenv('NEXTJS_API_URL', 'http://localhost:3000')
        self.active_sessions: Dict[str, Dict] = {}
        self.lock = threading.Lock()
        # Debug tracking
        self.debug_info = {
            'swings': [],  # List of detected swings
            'api_calls': [],  # List of API call attempts
            'connection_events': [],  # List of connection/disconnection events
            'bat_connected': False,
            'bat_address': None,
            'bat_name': None,
            'last_update': datetime.utcnow().isoformat()
        }
        self.debug_lock = threading.Lock()
        
    def start_detection(self, session_id: str) -> Dict:
        """Start swing detection for a session"""
        with self.lock:
            if session_id in self.active_sessions:
                return {
                    'success': False,
                    'error': 'Swing detection already running for this session'
                }
            
            # Create thread for this session
            thread = threading.Thread(
                target=self._run_detection,
                args=(session_id,),
                daemon=True
            )
            thread.start()
            
            self.active_sessions[session_id] = {
                'session_id': session_id,
                'thread': thread,
                'status': 'running',
                'started_at': datetime.utcnow().isoformat(),
            }
            
            logger.info(f"[Swing Detection] Started for session: {session_id}")
            
            return {
                'success': True,
                'session_id': session_id,
                'status': 'running'
            }
    
    def stop_detection(self, session_id: str) -> Dict:
        """Stop swing detection for a session"""
        with self.lock:
            if session_id not in self.active_sessions:
                return {
                    'success': False,
                    'error': 'Swing detection not running for this session'
                }
            
            # Mark as stopped (the thread will check this)
            self.active_sessions[session_id]['status'] = 'stopping'
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            logger.info(f"[Swing Detection] Stopped for session: {session_id}")
            
            return {
                'success': True,
                'session_id': session_id,
                'status': 'stopped'
            }
    
    def get_status(self, session_id: str) -> Dict:
        """Get status of swing detection for a session"""
        with self.lock:
            if session_id not in self.active_sessions:
                return {
                    'success': True,
                    'is_running': False,
                    'session_id': session_id
                }
            
            session = self.active_sessions[session_id]
            return {
                'success': True,
                'is_running': session['status'] == 'running',
                'session_id': session_id,
                'started_at': session.get('started_at')
            }
    
    def _add_debug_swing(self, swing_data: Dict):
        """Add swing to debug info"""
        with self.debug_lock:
            self.debug_info['swings'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'session_id': swing_data.get('sessionId'),
                'bat_speed_mph': swing_data.get('bat_speed_mph'),
                'duration_ms': swing_data.get('duration_ms'),
                'omega_peak_dps': swing_data.get('omega_peak_dps'),
                'attack_angle_deg': swing_data.get('attack_angle_deg'),
            })
            # Keep only last 50 swings
            if len(self.debug_info['swings']) > 50:
                self.debug_info['swings'] = self.debug_info['swings'][-50:]
            self.debug_info['last_update'] = datetime.utcnow().isoformat()
    
    def _add_debug_api_call(self, endpoint: str, success: bool, status_code: int = None, error: str = None):
        """Add API call to debug info"""
        with self.debug_lock:
            self.debug_info['api_calls'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'endpoint': endpoint,
                'success': success,
                'status_code': status_code,
                'error': error,
            })
            # Keep only last 100 API calls
            if len(self.debug_info['api_calls']) > 100:
                self.debug_info['api_calls'] = self.debug_info['api_calls'][-100:]
            self.debug_info['last_update'] = datetime.utcnow().isoformat()
    
    def _add_debug_connection_event(self, event_type: str, details: Dict = None):
        """Add connection event to debug info"""
        with self.debug_lock:
            self.debug_info['connection_events'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'event_type': event_type,  # 'scanning', 'found', 'connected', 'disconnected', 'error'
                'details': details or {},
            })
            # Keep only last 50 events
            if len(self.debug_info['connection_events']) > 50:
                self.debug_info['connection_events'] = self.debug_info['connection_events'][-50:]
            self.debug_info['last_update'] = datetime.utcnow().isoformat()
    
    def get_debug_info(self) -> Dict:
        """Get current debug information"""
        with self.debug_lock:
            return {
                'swings': self.debug_info['swings'].copy(),
                'api_calls': self.debug_info['api_calls'].copy(),
                'connection_events': self.debug_info['connection_events'].copy(),
                'bat_connected': self.debug_info['bat_connected'],
                'bat_address': self.debug_info['bat_address'],
                'bat_name': self.debug_info['bat_name'],
                'last_update': self.debug_info['last_update'],
                'active_sessions': len(self.active_sessions),
            }
    
    def _run_detection(self, session_id: str):
        """Run swing detection in a separate thread"""
        def on_swing_detected(swing_data: Dict):
            """Callback when swing is detected"""
            # Add swing to debug info
            self._add_debug_swing(swing_data)
            
            try:
                # Send swing data to Next.js
                swing_url = f"{self.nextjs_api_url}/api/blast/swings"
                response = requests.post(swing_url, json=swing_data, timeout=5)
                if response.ok:
                    logger.info(f"[*] Swing data sent to Next.js successfully")
                    self._add_debug_api_call(swing_url, True, response.status_code)
                else:
                    logger.warning(f"[*] Failed to send swing data: {response.status_code}")
                    self._add_debug_api_call(swing_url, False, response.status_code)
            except Exception as e:
                logger.error(f"[*] Error sending swing data: {e}")
                self._add_debug_api_call(swing_url, False, error=str(e))
            
            try:
                # Send stop signal to Next.js
                stop_url = f"{self.nextjs_api_url}/api/videos/stop"
                response = requests.post(stop_url, json={'sessionId': session_id}, timeout=5)
                if response.ok:
                    logger.info(f"[*] Stop signal sent to Next.js successfully")
                    self._add_debug_api_call(stop_url, True, response.status_code)
                else:
                    logger.warning(f"[*] Failed to send stop signal: {response.status_code}")
                    self._add_debug_api_call(stop_url, False, response.status_code)
            except Exception as e:
                logger.error(f"[*] Error sending stop signal: {e}")
                self._add_debug_api_call(stop_url, False, error=str(e))
        
        # Create detector
        detector = SwingDetector(session_id, self.nextjs_api_url, on_swing_detected)
        stop_evt = asyncio.Event()
        
        # Create new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(self._main_loop(detector, stop_evt, session_id))
        except Exception as e:
            logger.error(f"[Swing Detection] Error in detection loop: {e}", exc_info=True)
        finally:
            loop.close()
            with self.lock:
                if session_id in self.active_sessions:
                    self.active_sessions[session_id]['status'] = 'stopped'
    
    async def _main_loop(self, detector: SwingDetector, stop_evt: asyncio.Event, session_id: str):
        """Main async loop for BLE connection and swing detection"""
        while not stop_evt.is_set():
            # Check if session is still active
            with self.lock:
                if session_id not in self.active_sessions:
                    logger.info(f"[Swing Detection] Session {session_id} no longer active, stopping")
                    break
                if self.active_sessions[session_id]['status'] != 'running':
                    logger.info(f"[Swing Detection] Session {session_id} marked for stop")
                    break
            
            logger.info(f"[*] Scanning for BLAST@MOTION device...")
            self._add_debug_connection_event('scanning', {'session_id': session_id})
            with self.debug_lock:
                self.debug_info['bat_connected'] = False
                self.debug_info['bat_address'] = None
                self.debug_info['bat_name'] = None
            
            dev = await pick_device()
            if not dev:
                logger.info(f"[*] No BLAST@MOTION found. Retrying in 3 seconds...")
                self._add_debug_connection_event('not_found', {'session_id': session_id})
                await asyncio.sleep(3)
                continue
            
            addr = getattr(dev, "address", None)
            name = getattr(dev, "name", "Unknown")
            logger.info(f"[*] Found device: {name} ({addr})")
            self._add_debug_connection_event('found', {'session_id': session_id, 'name': name, 'address': addr})
            logger.info(f"[*] Connecting to {name} ({addr})...")
            
            try:
                async with BleakClient(addr, timeout=12.0) as client:
                    if not client.is_connected:
                        logger.warning(f"[!] Connection failed; retrying...")
                        self._add_debug_connection_event('connection_failed', {'session_id': session_id, 'address': addr})
                        await asyncio.sleep(2)
                        continue
                    
                    logger.info(f"[*] Connected to BLAST@MOTION device!")
                    self._add_debug_connection_event('connected', {'session_id': session_id, 'name': name, 'address': addr})
                    with self.debug_lock:
                        self.debug_info['bat_connected'] = True
                        self.debug_info['bat_address'] = addr
                        self.debug_info['bat_name'] = name
                    
                    logger.info(f"[*] Starting swing detection...")
                    logger.info(f"[*] Waiting for swing...")
                    
                    await subscribe_and_run(client, detector, stop_evt)
                    
                    # Disconnected
                    self._add_debug_connection_event('disconnected', {'session_id': session_id, 'name': name, 'address': addr})
                    with self.debug_lock:
                        self.debug_info['bat_connected'] = False
            except Exception as e:
                logger.warning(f"[!] Disconnect/error: {e}. Reconnect in 3s...")
                self._add_debug_connection_event('error', {'session_id': session_id, 'error': str(e)})
                with self.debug_lock:
                    self.debug_info['bat_connected'] = False
                await asyncio.sleep(3)
