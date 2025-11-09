'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Loader2, Radio } from 'lucide-react';
import { getSwingDetectionStatus, startSwingDetection, stopSwingDetection } from '@/lib/services/blast-connector';
import { getAuthToken } from '@/lib/auth0/client';

interface SwingDetectionStatusProps {
  onStatusChange?: (isRunning: boolean) => void;
}

export default function SwingDetectionStatus({ onStatusChange }: SwingDetectionStatusProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [statusDetails, setStatusDetails] = useState<any>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await getSwingDetectionStatus(token);
      if (response.success) {
        setIsRunning(response.isRunning);
        if (response.details) {
          setStatusDetails(response.details);
          if (response.details.device_name) {
            setDeviceName(response.details.device_name);
          }
        }
        if (onStatusChange) {
          onStatusChange(response.isRunning);
        }
      }
    } catch (err: any) {
      console.error('Error checking swing detection status:', err);
      setError(err.message || 'Failed to check status');
      setIsRunning(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const sessionId = `status-check-${Date.now()}`;
      await startSwingDetection(sessionId, token);
      await checkStatus();
    } catch (err: any) {
      console.error('Error starting swing detection:', err);
      setError(err.message || 'Failed to start swing detection');
      // Check if it's because bat is not connected
      if (err.message?.includes('BLAST@MOTION') || err.message?.includes('not found')) {
        setError('Bat not found. Make sure your BLAST@MOTION device is powered on and nearby.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      await stopSwingDetection(token);
      await checkStatus();
    } catch (err: any) {
      console.error('Error stopping swing detection:', err);
      setError(err.message || 'Failed to stop swing detection');
    } finally {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll status every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Swing Detection Status</h2>
      </div>

      {isChecking && (
        <div className="flex items-center gap-2 text-gray-600 mb-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Checking status...</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!isChecking && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-2 ${
            isRunning 
              ? 'bg-green-50 border-green-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Bat Connected</p>
                      <p className="text-sm text-green-600">
                        {deviceName || 'BLAST@MOTION device detected'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-semibold text-gray-700">Bat Not Connected</p>
                      <p className="text-sm text-gray-500">
                        No BLAST@MOTION device detected
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                ) : (
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    Start Detection
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={isStopping}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStopping ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Stop Detection
                  </>
                )}
              </button>
            )}
            <button
              onClick={checkStatus}
              disabled={isChecking}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Loader2 className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {statusDetails && isRunning && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-800 font-medium mb-2">Detection Status:</p>
              <div className="text-xs text-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span>State:</span>
                  <span className="font-semibold">{statusDetails.state || 'unknown'}</span>
                </div>
                {statusDetails.device_found && (
                  <>
                    <div className="flex justify-between">
                      <span>Device:</span>
                      <span className="font-semibold">{statusDetails.device_name || 'Found'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connected:</span>
                      <span className={statusDetails.connected ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                        {statusDetails.connected ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </>
                )}
                {statusDetails.data_received && (
                  <div className="flex justify-between">
                    <span>Receiving Data:</span>
                    <span className="text-green-600 font-semibold">Yes</span>
                  </div>
                )}
                {statusDetails.swings_detected > 0 && (
                  <div className="flex justify-between">
                    <span>Swing Detected:</span>
                    <span className="text-green-600 font-semibold">{statusDetails.swings_detected}</span>
                  </div>
                )}
                {statusDetails.scan_attempts > 0 && (
                  <div className="flex justify-between">
                    <span>Scan Attempts:</span>
                    <span>{statusDetails.scan_attempts}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-1">How it works:</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Make sure your BLAST@MOTION bat sensor is powered on</li>
              <li>Click "Start Detection" to search for the device</li>
              <li>When connected, recording will automatically start swing detection</li>
              <li>Recording will stop automatically when a swing is detected</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

