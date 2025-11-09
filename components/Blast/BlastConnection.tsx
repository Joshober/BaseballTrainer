'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bluetooth,
  CheckCircle,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useBlastBluetooth, BLAST_DEFAULTS } from '@/lib/hooks/useBlastBluetooth';
import type { BlastData } from '@/lib/services/blast-connector';

interface BlastConnectionProps {
  onConnected?: (deviceId: string) => void;
  onData?: (data: BlastData) => void;
}

export default function BlastConnection({ onConnected, onData }: BlastConnectionProps) {
  const [showLogs, setShowLogs] = useState(false);

  const {
    isSupported,
    isConnecting,
    isConnected,
    isStreaming,
    device,
    error,
    latestData,
    discoveredServices,
    logs,
    requestDevice,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    clearLogs,
  } = useBlastBluetooth({
    deviceNamePrefix: BLAST_DEFAULTS.NAME_PREFIXES[0],
    serviceUUIDs: BLAST_DEFAULTS.SERVICE_UUIDS,
    characteristicUUIDs: BLAST_DEFAULTS.CHARACTERISTIC_UUIDS,
    allowAllDevices: false,
    autoReconnect: true,
    onData,
  });

  useEffect(() => {
    if (isConnected && device?.id) {
      onConnected?.(device.id);
    }
  }, [device?.id, isConnected, onConnected]);

  const handlePairAndStream = useCallback(async () => {
    try {
      const selectedDevice = await requestDevice();
      await connect(selectedDevice);
      await startStreaming();
    } catch (pairError) {
      console.error('Failed to pair with Blast Motion device:', pairError);
    }
  }, [connect, requestDevice, startStreaming]);

  const handleStartStreaming = useCallback(async () => {
    try {
      if (!isConnected) {
        await connect();
      }
      await startStreaming();
    } catch (streamError) {
      console.error('Failed to start streaming:', streamError);
    }
  }, [connect, isConnected, startStreaming]);

  const handleStopStreaming = useCallback(async () => {
    try {
      await stopStreaming();
    } catch (stopError) {
      console.error('Failed to stop streaming:', stopError);
    }
  }, [stopStreaming]);

  const metricsSummary = useMemo(() => {
    if (!latestData) return [];
    const { batSpeed, attackAngle, timeToContact, power, handSpeed, connection: connectionScore } = latestData;
    return [
      { label: 'Bat Speed', value: batSpeed, unit: 'mph' },
      { label: 'Attack Angle', value: attackAngle, unit: '°' },
      { label: 'Time to Contact', value: timeToContact, unit: 'ms' },
      { label: 'Power', value: power, unit: '' },
      { label: 'Hand Speed', value: handSpeed, unit: 'mph' },
      { label: 'Connection', value: connectionScore, unit: '%' },
    ].filter((metric) => metric.value !== undefined && metric.value !== null);
  }, [latestData]);

  const statusMessage = useMemo(() => {
    if (!isSupported) {
      return {
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
        text: 'Web Bluetooth is not supported in this browser.',
        tone: 'text-red-700',
      };
    }

    if (isStreaming) {
      return {
        icon: <Activity className="w-5 h-5 text-green-600 animate-pulse" />,
        text: 'Streaming live swing data.',
        tone: 'text-green-700',
      };
    }

    if (isConnected) {
      return {
        icon: <CheckCircle className="w-5 h-5 text-blue-600" />,
        text: 'Connected – start streaming to receive live metrics.',
        tone: 'text-blue-700',
      };
    }

    if (isConnecting) {
      return {
        icon: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
        text: 'Connecting to Blast Motion sensor…',
        tone: 'text-blue-700',
      };
    }

    return {
      icon: <WifiOff className="w-5 h-5 text-gray-500" />,
      text: 'Not connected.',
      tone: 'text-gray-600',
    };
  }, [isConnected, isConnecting, isStreaming, isSupported]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
      <div className="flex items-center gap-2">
        {isConnected ? <Wifi className="w-6 h-6 text-green-600" /> : <WifiOff className="w-6 h-6 text-gray-400" />}
        <h2 className="text-xl font-bold text-gray-900">Blast Motion Sensor</h2>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {statusMessage.icon}
        <span className={statusMessage.tone}>{statusMessage.text}</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!isSupported && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Enable Bluetooth in your browser (Chrome/Edge) and ensure the site is served over HTTPS.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handlePairAndStream}
          disabled={!isSupported || isConnecting}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bluetooth className="w-5 h-5" />}
          {isConnecting ? 'Pairing…' : 'Pair & Stream'}
        </button>

        <button
          type="button"
          onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
          disabled={!isSupported || (!isConnected && !device) || isConnecting}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStreaming ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
          {isStreaming ? 'Pause Streaming' : 'Start Streaming'}
        </button>

        <button
          type="button"
          onClick={() => connect().catch((err) => console.error('Reconnect failed:', err))}
          disabled={!device || isStreaming || isConnecting}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw className="w-5 h-5" />
          Reconnect
        </button>

        <button
          type="button"
          onClick={() => disconnect().catch((err) => console.error('Disconnect failed:', err))}
          disabled={!device}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <WifiOff className="w-5 h-5" />
          Disconnect
        </button>
      </div>

      {device && (
        <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
          <p className="font-semibold text-gray-900">Device</p>
          <div className="flex flex-col gap-1">
            <span>Name: {device.name ?? 'Unknown device'}</span>
            <span>ID: {device.id}</span>
          </div>
        </div>
      )}

      {metricsSummary.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800 mb-3">Latest swing metrics</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metricsSummary.map((metric) => (
              <div key={metric.label} className="bg-white rounded-md border border-green-100 p-3 shadow-sm">
                <p className="text-xs uppercase text-gray-500 tracking-wide">{metric.label}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value}
                  {metric.unit && <span className="ml-1 text-sm text-gray-500">{metric.unit}</span>}
                </p>
              </div>
            ))}
          </div>
          {latestData?.rawPayloadHex && (
            <p className="mt-3 text-xs text-gray-500 break-all">
              Raw payload: <span className="font-mono">{latestData.rawPayloadHex}</span>
            </p>
          )}
        </div>
      )}

      {discoveredServices.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">Discovered services</p>
            <button
              type="button"
              onClick={() => setShowLogs((prev) => !prev)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showLogs ? 'Hide logs' : 'Show logs'}
            </button>
          </div>
          <ul className="space-y-2 text-sm text-gray-700 max-h-56 overflow-y-auto pr-2">
            {discoveredServices.map((service) => (
              <li key={service.uuid} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                <p className="font-semibold text-gray-800 break-all">Service: {service.uuid}</p>
                <div className="mt-2 space-y-1">
                  {service.characteristics.map((characteristic) => (
                    <div key={characteristic.uuid} className="flex flex-col">
                      <span className="text-xs text-gray-600 break-all">
                        Characteristic: {characteristic.uuid}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Notify: {String(characteristic.properties.notify)} | Indicate:{' '}
                        {String(characteristic.properties.indicate)} | Read:{' '}
                        {String(characteristic.properties.read)}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showLogs && logs.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">Bluetooth logs</p>
            <button
              type="button"
              onClick={clearLogs}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto font-mono text-xs text-gray-600 pr-2 space-y-1">
            {logs.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

