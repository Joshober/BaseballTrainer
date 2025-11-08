"""
Queue endpoints to offload video analysis from Next.js
Runs analysis in a background thread and posts results back to Next for saving
"""
from flask import Blueprint, request, jsonify
import os
import threading
import queue as thread_queue
import time
import logging
import requests
from pathlib import Path
from services.video_analyzer import VideoAnalyzer  # reuse analyzer
from middleware.auth import require_auth

bp = Blueprint('queue', __name__)
logger = logging.getLogger(__name__)

_jobs = {}
_q = thread_queue.Queue()
_worker_started = False
_lock = threading.Lock()


def _start_worker():
    global _worker_started
    with _lock:
        if _worker_started:
            return
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        _worker_started = True


def _resolve_storage_url(video_url: str | None, video_path: str | None) -> str:
    storage_base = os.getenv('STORAGE_SERVER_URL') or os.getenv('NGROK_STORAGE_SERVER_URL') or 'http://localhost:5003'
    if video_path:
        return f"{storage_base}/api/storage/{video_path}"
    if video_url and video_url.startswith('/api/storage/'):
        return f"{storage_base}{video_url}"
    # If it's already absolute, return as-is
    return video_url or ''


def _worker_loop():
    while True:
        job_id = _q.get()
        job = _jobs.get(job_id)
        if not job:
            continue
        try:
            _update_job(job_id, 'downloading')
            url = _resolve_storage_url(job.get('videoUrl'), job.get('videoPath'))
            if not url:
                raise ValueError('Missing video url/path')
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            video_bytes = r.content

            _update_job(job_id, 'processing')
            analyzer = VideoAnalyzer()
            # best-effort filename from path/url
            filename = Path(job.get('videoPath') or '').name or 'video.mp4'
            result = analyzer.analyze_video(video_bytes, filename)

            _update_job(job_id, 'saving')
            callback = job.get('callbackUrl')
            if not callback:
                raise ValueError('Missing callbackUrl')
            headers = {
                'Authorization': job.get('authHeader', ''),
                'Content-Type': 'application/json',
            }
            payload = {
                'sessionId': job.get('sessionId'),
                'videoUrl': job.get('videoUrl'),
                'videoFileName': filename,
                'analysis': result,
            }
            resp = requests.post(callback, json=payload, headers=headers, timeout=60)
            if resp.status_code >= 300:
                raise RuntimeError(f"Callback failed: {resp.status_code} {resp.text}")

            _update_job(job_id, 'completed')
        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            _update_job(job_id, 'failed', str(e))
        finally:
            _q.task_done()


def _update_job(job_id: str, status: str, error: str | None = None):
    with _lock:
        j = _jobs.get(job_id)
        if not j:
            return
        j['status'] = status
        j['updatedAt'] = int(time.time())
        if error:
            j['error'] = error


@bp.route('/api/pose/queue-video', methods=['POST'])
@require_auth
def queue_video():
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('sessionId')
        video_url = data.get('videoUrl')
        video_path = data.get('videoPath')
        callback_url = data.get('callbackUrl')
        if not callback_url:
            return jsonify({'error': 'Missing callbackUrl'}), 400
        if not (video_url or video_path):
            return jsonify({'error': 'Missing videoUrl or videoPath'}), 400

        # Create job
        job_id = str(time.time_ns())
        auth_header = request.headers.get('Authorization', '')
        _jobs[job_id] = {
            'id': job_id,
            'status': 'queued',
            'sessionId': session_id,
            'videoUrl': video_url,
            'videoPath': video_path,
            'callbackUrl': callback_url,
            'authHeader': auth_header,
            'createdAt': int(time.time()),
            'updatedAt': int(time.time()),
        }
        _start_worker()
        _q.put(job_id)
        return jsonify({ 'jobId': job_id, 'status': 'queued' })
    except Exception as e:
        logger.exception(f"Queue error: {e}")
        return jsonify({ 'error': 'Internal server error', 'message': str(e) }), 500


@bp.route('/api/pose/jobs/<job_id>', methods=['GET'])
def job_status(job_id: str):
    j = _jobs.get(job_id)
    if not j:
        return jsonify({ 'error': 'Job not found' }), 404
    return jsonify(j)

