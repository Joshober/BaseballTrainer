"""
Debug page for swing detection
Shows swings, API calls, and connection status
"""
from flask import Blueprint, render_template_string, jsonify
from services.swing_detection_service import SwingDetectionService
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('debug', __name__)

# Get the swing detection service instance
# We'll need to import it from swings.py or make it accessible
_swing_detection_service = None

def set_swing_detection_service(service: SwingDetectionService):
    """Set the swing detection service instance"""
    global _swing_detection_service
    _swing_detection_service = service

DEBUG_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swing Detection Debug</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: #2563eb;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .status-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .status-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .status-card h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .status-card .value.connected {
            color: #10b981;
        }
        .status-card .value.disconnected {
            color: #ef4444;
        }
        .status-card .value.scanning {
            color: #f59e0b;
        }
        .columns {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        .panel {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .panel-header {
            background: #2563eb;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
        }
        .panel-content {
            padding: 20px;
            max-height: 500px;
            overflow-y: auto;
        }
        .event-item {
            padding: 12px;
            border-left: 3px solid #e5e7eb;
            margin-bottom: 10px;
            background: #f9fafb;
            border-radius: 4px;
        }
        .event-item.success {
            border-left-color: #10b981;
        }
        .event-item.error {
            border-left-color: #ef4444;
        }
        .event-item.info {
            border-left-color: #3b82f6;
        }
        .event-item.warning {
            border-left-color: #f59e0b;
        }
        .event-time {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .event-details {
            font-size: 14px;
            color: #333;
        }
        .swing-item {
            padding: 15px;
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .swing-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .swing-stat {
            font-size: 13px;
        }
        .swing-stat-label {
            color: #666;
            font-weight: 500;
        }
        .swing-stat-value {
            color: #333;
            font-weight: bold;
            font-size: 16px;
        }
        .api-call-item {
            padding: 12px;
            border-left: 3px solid #e5e7eb;
            margin-bottom: 10px;
            background: #f9fafb;
            border-radius: 4px;
        }
        .api-call-item.success {
            border-left-color: #10b981;
        }
        .api-call-item.error {
            border-left-color: #ef4444;
        }
        .api-endpoint {
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .api-status {
            font-size: 12px;
            color: #666;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        .refresh-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px 15px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-size: 12px;
            color: #666;
        }
        .refresh-indicator.updating {
            color: #2563eb;
        }
        .refresh-indicator .spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            margin-right: 5px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Swing Detection Debug</h1>
        <p class="subtitle">Real-time monitoring of swings, API calls, and connection status</p>
        
        <div class="refresh-indicator" id="refreshIndicator">
            <span class="spinner"></span>
            <span id="lastUpdate">Updating...</span>
        </div>
        
        <div class="status-bar">
            <div class="status-card">
                <h3>Bat Connection</h3>
                <div class="value" id="batStatus">Unknown</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;" id="batDetails"></div>
            </div>
            <div class="status-card">
                <h3>Active Sessions</h3>
                <div class="value" id="activeSessions">0</div>
            </div>
            <div class="status-card">
                <h3>Total Swings</h3>
                <div class="value" id="totalSwings">0</div>
            </div>
            <div class="status-card">
                <h3>API Calls</h3>
                <div class="value" id="totalApiCalls">0</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    <span id="successApiCalls" style="color: #10b981;">0</span> success / 
                    <span id="failedApiCalls" style="color: #ef4444;">0</span> failed
                </div>
            </div>
        </div>
        
        <div class="columns">
            <div class="panel">
                <div class="panel-header">🦇 Recent Swings</div>
                <div class="panel-content" id="swingsList">
                    <div class="empty-state">No swings detected yet</div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-header">📡 API Calls</div>
                <div class="panel-content" id="apiCallsList">
                    <div class="empty-state">No API calls yet</div>
                </div>
            </div>
        </div>
        
        <div class="panel" style="margin-top: 20px;">
            <div class="panel-header">🔌 Connection Events</div>
            <div class="panel-content" id="connectionEventsList">
                <div class="empty-state">No connection events yet</div>
            </div>
        </div>
    </div>
    
    <script>
        let lastUpdateTime = null;
        
        function formatTime(timestamp) {
            if (!timestamp) return 'Never';
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            
            if (diffSec < 60) {
                return diffSec + 's ago';
            } else if (diffSec < 3600) {
                return Math.floor(diffSec / 60) + 'm ago';
            } else {
                return date.toLocaleTimeString();
            }
        }
        
        function updateUI(data) {
            // Update status bar
            const batStatusEl = document.getElementById('batStatus');
            const batDetailsEl = document.getElementById('batDetails');
            
            if (data.bat_connected) {
                batStatusEl.textContent = 'Connected';
                batStatusEl.className = 'value connected';
                batDetailsEl.textContent = `${data.bat_name || 'Unknown'} (${data.bat_address || 'N/A'})`;
            } else {
                batStatusEl.textContent = 'Disconnected';
                batStatusEl.className = 'value disconnected';
                batDetailsEl.textContent = 'Scanning for device...';
            }
            
            document.getElementById('activeSessions').textContent = data.active_sessions || 0;
            document.getElementById('totalSwings').textContent = data.swings?.length || 0;
            document.getElementById('totalApiCalls').textContent = data.api_calls?.length || 0;
            
            const successCalls = (data.api_calls || []).filter(c => c.success).length;
            const failedCalls = (data.api_calls || []).filter(c => !c.success).length;
            document.getElementById('successApiCalls').textContent = successCalls;
            document.getElementById('failedApiCalls').textContent = failedCalls;
            
            // Update swings list
            const swingsList = document.getElementById('swingsList');
            if (data.swings && data.swings.length > 0) {
                swingsList.innerHTML = data.swings.slice().reverse().map(swing => `
                    <div class="swing-item">
                        <div class="event-time">${formatTime(swing.timestamp)}</div>
                        <div class="swing-stats">
                            <div class="swing-stat">
                                <div class="swing-stat-label">Bat Speed</div>
                                <div class="swing-stat-value">${swing.bat_speed_mph || 0} mph</div>
                            </div>
                            <div class="swing-stat">
                                <div class="swing-stat-label">Duration</div>
                                <div class="swing-stat-value">${swing.duration_ms || 0} ms</div>
                            </div>
                            <div class="swing-stat">
                                <div class="swing-stat-label">Peak Ω</div>
                                <div class="swing-stat-value">${swing.omega_peak_dps || 0} dps</div>
                            </div>
                            <div class="swing-stat">
                                <div class="swing-stat-label">Session</div>
                                <div class="swing-stat-value" style="font-size: 11px; word-break: break-all;">${swing.session_id || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                swingsList.innerHTML = '<div class="empty-state">No swings detected yet</div>';
            }
            
            // Update API calls list
            const apiCallsList = document.getElementById('apiCallsList');
            if (data.api_calls && data.api_calls.length > 0) {
                apiCallsList.innerHTML = data.api_calls.slice().reverse().map(call => `
                    <div class="api-call-item ${call.success ? 'success' : 'error'}">
                        <div class="event-time">${formatTime(call.timestamp)}</div>
                        <div class="api-endpoint">${call.endpoint || 'Unknown'}</div>
                        <div class="api-status">
                            ${call.success ? 
                                `✅ Success (${call.status_code || 'OK'})` : 
                                `❌ Failed: ${call.error || `Status ${call.status_code || 'Unknown'}`}`
                            }
                        </div>
                    </div>
                `).join('');
            } else {
                apiCallsList.innerHTML = '<div class="empty-state">No API calls yet</div>';
            }
            
            // Update connection events
            const connectionEventsList = document.getElementById('connectionEventsList');
            if (data.connection_events && data.connection_events.length > 0) {
                connectionEventsList.innerHTML = data.connection_events.slice().reverse().map(event => {
                    let className = 'info';
                    let icon = 'ℹ️';
                    if (event.event_type === 'connected') {
                        className = 'success';
                        icon = '✅';
                    } else if (event.event_type === 'error' || event.event_type === 'connection_failed') {
                        className = 'error';
                        icon = '❌';
                    } else if (event.event_type === 'scanning' || event.event_type === 'found') {
                        className = 'warning';
                        icon = '🔍';
                    } else if (event.event_type === 'disconnected') {
                        className = 'warning';
                        icon = '⚠️';
                    }
                    
                    let details = '';
                    if (event.details) {
                        if (event.details.name) details += ` Name: ${event.details.name}`;
                        if (event.details.address) details += ` Address: ${event.details.address}`;
                        if (event.details.error) details += ` Error: ${event.details.error}`;
                    }
                    
                    return `
                        <div class="event-item ${className}">
                            <div class="event-time">${formatTime(event.timestamp)}</div>
                            <div class="event-details">
                                ${icon} <strong>${event.event_type}</strong>${details}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                connectionEventsList.innerHTML = '<div class="empty-state">No connection events yet</div>';
            }
            
            // Update last update time
            lastUpdateTime = data.last_update;
            document.getElementById('lastUpdate').textContent = `Updated ${formatTime(data.last_update)}`;
        }
        
        async function fetchDebugInfo() {
            const indicator = document.getElementById('refreshIndicator');
            indicator.classList.add('updating');
            
            try {
                const response = await fetch('/api/debug/swing-detection');
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error('Error fetching debug info:', error);
            } finally {
                indicator.classList.remove('updating');
            }
        }
        
        // Fetch immediately and then every 2 seconds
        fetchDebugInfo();
        setInterval(fetchDebugInfo, 2000);
    </script>
</body>
</html>
"""

@bp.route('/debug')
def debug_page():
    """Serve the debug HTML page"""
    return render_template_string(DEBUG_HTML)

@bp.route('/api/debug/swing-detection')
def debug_api():
    """API endpoint to get debug information"""
    if not _swing_detection_service:
        return jsonify({
            'error': 'Swing detection service not initialized'
        }), 500
    
    try:
        debug_info = _swing_detection_service.get_debug_info()
        return jsonify(debug_info)
    except Exception as e:
        logger.error(f'Error getting debug info: {e}', exc_info=True)
        return jsonify({
            'error': str(e)
        }), 500


