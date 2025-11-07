'use client';

import React, { useState } from 'react';
import { Loader2, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { connectBlastDevice, sendBlastData, type BlastData } from '@/lib/services/blast-connector';
import { getAuthToken } from '@/lib/auth0/client';

interface BlastConnectionProps {
  onConnected?: (deviceId: string) => void;
  onData?: (data: BlastData) => void;
}

export default function BlastConnection({ onConnected, onData }: BlastConnectionProps) {
  const [deviceId, setDeviceId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    if (!deviceId || !apiKey) {
      setError('Please enter both device ID and API key');
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await connectBlastDevice(deviceId, apiKey, token);
      
      if (response.success) {
        setConnected(true);
        setSuccess(true);
        if (onConnected) {
          onConnected(deviceId);
        }
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error('Failed to connect device');
      }
    } catch (err: any) {
      console.error('Blast connection error:', err);
      setError(err.message || 'Failed to connect to Blast Motion device');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setDeviceId('');
    setApiKey('');
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        {connected ? (
          <Wifi className="w-6 h-6 text-green-600" />
        ) : (
          <WifiOff className="w-6 h-6 text-gray-400" />
        )}
        <h2 className="text-xl font-bold text-gray-900">Blast Motion Connection</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>Successfully connected to Blast Motion device!</span>
        </div>
      )}

      {!connected ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Enter Blast Motion device ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Blast Motion API key"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting || !deviceId || !apiKey}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5" />
                Connect Device
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">Connected to device: {deviceId}</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

