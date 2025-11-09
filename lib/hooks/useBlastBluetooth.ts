'use client';

/**
 * Hook for interacting with Blast Motion sensors over Web Bluetooth.
 *
 * This implementation uses the browser-native Web Bluetooth API.
 * UUIDs included below are placeholders – update them once the Blast Motion
 * characteristics are confirmed. The hook logs all discovered services and
 * characteristics so you can inspect the device layout after the first pairing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlastData } from '@/lib/services/blast-connector';

const DEFAULT_SERVICE_UUIDS: BluetoothServiceUUID[] = [
  // Placeholder UUIDs – replace with the official Blast Motion service IDs once known.
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000180d-0000-1000-8000-00805f9b34fb', // Heart Rate (example of a common sensor service)
];

const DEFAULT_CHARACTERISTIC_UUIDS: BluetoothCharacteristicUUID[] = [
  // Placeholder characteristic UUIDs – update with Blast Motion metrics characteristic IDs.
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '00002a37-0000-1000-8000-00805f9b34fb',
];

const BLAST_NAME_PREFIXES = ['Blast', 'Blast Motion'];

export interface DiscoveredCharacteristic {
  uuid: string;
  properties: BluetoothCharacteristicProperties;
}

export interface DiscoveredService {
  uuid: string;
  characteristics: DiscoveredCharacteristic[];
}

export interface UseBlastBluetoothOptions {
  /**
   * Device name prefix to match during discovery.
   * Defaults to checking common Blast Motion name patterns.
   */
  deviceNamePrefix?: string;
  /**
   * Service UUIDs to request during discovery.
   * Populated with placeholders until the Blast Motion services are identified.
   */
  serviceUUIDs?: BluetoothServiceUUID[];
  /**
   * Characteristic UUIDs that contain swing metrics.
   * Used to prioritise streaming from relevant characteristics.
   */
  characteristicUUIDs?: BluetoothCharacteristicUUID[];
  /**
   * Allow pairing with any device (useful for initial exploration).
   * When true, filters are skipped and every characteristic discovered will be logged.
   */
  allowAllDevices?: boolean;
  /**
   * Automatically attempt to reconnect if the device disconnects unexpectedly.
   */
  autoReconnect?: boolean;
  /**
   * Optional custom parser if the payload format is known.
   */
  parseData?: (dataView: DataView, context: { device: BluetoothDevice | null; characteristic: BluetoothRemoteGATTCharacteristic }) => BlastData;
  /**
   * Callback invoked each time a new packet is parsed.
   */
  onData?: (data: BlastData) => void;
  /**
   * Callback invoked when the device disconnects.
   */
  onDisconnect?: (device: BluetoothDevice | null) => void;
}

export interface UseBlastBluetoothResult {
  isSupported: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isStreaming: boolean;
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  error: string | null;
  latestData: BlastData | null;
  discoveredServices: DiscoveredService[];
  logs: string[];
  requestDevice: () => Promise<BluetoothDevice>;
  connect: (targetDevice?: BluetoothDevice) => Promise<BluetoothRemoteGATTServer>;
  disconnect: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  clearLogs: () => void;
}

interface NotificationBinding {
  characteristic: BluetoothRemoteGATTCharacteristic;
  handler: (event: Event) => void;
}

/**
 * Basic parser that assumes the sensor sends little-endian float32 values in the following order:
 *  - Bat speed (mph)
 *  - Attack angle (degrees)
 *  - Time to contact (ms)
 *  - Power (unitless)
 *  - Hand speed (mph)
 *  - Connection score (%)
 *
 * If the payload layout differs, update this function or provide a custom parser via options.parseData.
 */
function defaultBlastParser(
  dataView: DataView,
  context: { device: BluetoothDevice | null; characteristic: BluetoothRemoteGATTCharacteristic }
): BlastData {
  const toHex = () => {
    const bytes = new Uint8Array(dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + dataView.byteLength));
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  };

  const safeGetFloat = (index: number) => {
    const byteOffset = index * 4;
    if (dataView.byteLength >= byteOffset + 4) {
      return Number(dataView.getFloat32(byteOffset, true).toFixed(3));
    }
    return undefined;
  };

  return {
    deviceId: context.device?.id,
    timestamp: Date.now(),
    batSpeed: safeGetFloat(0),
    attackAngle: safeGetFloat(1),
    timeToContact: safeGetFloat(2),
    power: safeGetFloat(3),
    handSpeed: safeGetFloat(4),
    connection: safeGetFloat(5),
    rawPayloadHex: toHex(),
    characteristic: context.characteristic.uuid,
  };
}

export function useBlastBluetooth(options: UseBlastBluetoothOptions = {}): UseBlastBluetoothResult {
  const {
    deviceNamePrefix,
    serviceUUIDs = DEFAULT_SERVICE_UUIDS,
    characteristicUUIDs = DEFAULT_CHARACTERISTIC_UUIDS,
    allowAllDevices = false,
    autoReconnect = true,
    parseData = defaultBlastParser,
    onData,
    onDisconnect,
  } = options;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [server, setServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<BlastData | null>(null);
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const notificationBindings = useRef<NotificationBinding[]>([]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      setIsSupported(false);
      setLogs((prev) => [...prev, 'Web Bluetooth is not available in this environment.']);
      return;
    }

    let cancelled = false;

    navigator.bluetooth
      .getAvailability()
      .then((available) => {
        if (!cancelled) {
          setIsSupported(available);
          if (!available) {
            setLogs((prev) => [...prev, 'Bluetooth radio is unavailable or disabled.']);
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setIsSupported(false);
          setLogs((prev) => [...prev, `Failed to query Bluetooth availability: ${err.message}`]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const appendLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleDisconnected = useCallback(
    async (event: Event) => {
      const currentDevice = event.target as BluetoothDevice;
      appendLog(`Device ${currentDevice.name ?? currentDevice.id} disconnected.`);
      setIsConnected(false);
      setIsStreaming(false);
      setServer(null);
      setDiscoveredServices([]);
      notificationBindings.current = [];
      onDisconnect?.(currentDevice);

      if (autoReconnect && currentDevice.gatt) {
        try {
          appendLog('Attempting to reconnect...');
          const newServer = await currentDevice.gatt.connect();
          setServer(newServer);
          setIsConnected(true);
          appendLog('Reconnected successfully.');
          await discoverServices(newServer);
        } catch (reconnectError) {
          appendLog(`Auto-reconnect failed: ${(reconnectError as Error).message}`);
        }
      }
    },
    [appendLog, autoReconnect, onDisconnect]
  );

  const requestDevice = useCallback(async (): Promise<BluetoothDevice> => {
    if (!isSupported || typeof navigator === 'undefined' || !navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser.');
    }

    setError(null);

    const resolvedNamePrefix = deviceNamePrefix || BLAST_NAME_PREFIXES[0];
    const filters: BluetoothRequestDeviceFilter[] = [];

    if (!allowAllDevices) {
      filters.push({
        namePrefix: resolvedNamePrefix,
        services: serviceUUIDs,
      });
    }

    const requestOptions: RequestDeviceOptions = allowAllDevices || filters.length === 0
      ? {
          acceptAllDevices: true,
          optionalServices: Array.from(new Set([...serviceUUIDs, ...characteristicUUIDs])),
        }
      : {
          filters,
          optionalServices: Array.from(new Set([...serviceUUIDs, ...characteristicUUIDs])),
        };

    appendLog('Requesting Blast Motion device...');

    const requestedDevice = await navigator.bluetooth.requestDevice(requestOptions);

    requestedDevice.addEventListener('gattserverdisconnected', handleDisconnected);
    setDevice(requestedDevice);
    appendLog(`Selected device: ${requestedDevice.name ?? requestedDevice.id}`);

    return requestedDevice;
  }, [
    allowAllDevices,
    appendLog,
    characteristicUUIDs,
    deviceNamePrefix,
    handleDisconnected,
    isSupported,
    serviceUUIDs,
  ]);

  const discoverServices = useCallback(
    async (activeServer: BluetoothRemoteGATTServer) => {
      appendLog('Discovering primary services and characteristics...');
      const services = await activeServer.getPrimaryServices();

      const serviceSummaries: DiscoveredService[] = [];
      const nextBindings: NotificationBinding[] = [];

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        const characteristicSummaries: DiscoveredCharacteristic[] = [];

        for (const characteristic of characteristics) {
          characteristicSummaries.push({
            uuid: characteristic.uuid,
            properties: characteristic.properties,
          });

          // Prioritise configured characteristic UUIDs, otherwise subscribe to any characteristic that notifies.
          const shouldStream =
            (characteristicUUIDs?.length && characteristicUUIDs.includes(characteristic.uuid)) ||
            characteristic.properties?.notify ||
            characteristic.properties?.indicate;

          if (shouldStream) {
            nextBindings.push({ characteristic, handler: () => undefined });
          }
        }

        serviceSummaries.push({
          uuid: service.uuid,
          characteristics: characteristicSummaries,
        });
      }

      setDiscoveredServices(serviceSummaries);
      notificationBindings.current = nextBindings;
      appendLog(`Discovered ${serviceSummaries.length} services and ${notificationBindings.current.length} stream-ready characteristics.`);
    },
    [appendLog, characteristicUUIDs]
  );

  const connect = useCallback(
    async (targetDevice?: BluetoothDevice) => {
      setIsConnecting(true);
      setError(null);

      try {
        const activeDevice = targetDevice ?? device ?? (await requestDevice());

        if (!activeDevice.gatt) {
          throw new Error('Selected device does not expose a GATT server.');
        }

        appendLog('Connecting to device...');
        const activeServer = await activeDevice.gatt.connect();
        setServer(activeServer);
        setDevice(activeDevice);
        setIsConnected(true);
        appendLog('Connected to Blast Motion device.');

        await discoverServices(activeServer);

        return activeServer;
      } catch (connectError) {
        const message = (connectError as Error).message || 'Failed to connect to Blast Motion device.';
        setError(message);
        appendLog(`Connection error: ${message}`);
        throw connectError;
      } finally {
        setIsConnecting(false);
      }
    },
    [appendLog, device, discoverServices, requestDevice]
  );

  const stopStreaming = useCallback(async () => {
    if (!notificationBindings.current.length) {
      setIsStreaming(false);
      return;
    }

    appendLog('Stopping notifications...');

    await Promise.all(
      notificationBindings.current.map(async ({ characteristic, handler }) => {
        characteristic.removeEventListener('characteristicvaluechanged', handler);

        try {
          if (characteristic.properties.notify || characteristic.properties.indicate) {
            await characteristic.stopNotifications();
          }
        } catch (stopError) {
          appendLog(`Failed to stop notifications for ${characteristic.uuid}: ${(stopError as Error).message}`);
        }
      })
    );

    notificationBindings.current = [];
    setIsStreaming(false);
    appendLog('Notifications stopped.');
  }, [appendLog]);

  const disconnect = useCallback(async () => {
    await stopStreaming();

    if (!device?.gatt) {
      setIsConnected(false);
      setDevice(null);
      setServer(null);
      return;
    }

    appendLog('Disconnecting from device...');
    try {
      device.removeEventListener('gattserverdisconnected', handleDisconnected);
      device.gatt.disconnect();
      appendLog('Device disconnected.');
    } catch (disconnectError) {
      appendLog(`Failed to disconnect: ${(disconnectError as Error).message}`);
    } finally {
      setIsConnected(false);
      setDevice(null);
      setServer(null);
      setDiscoveredServices([]);
    }
  }, [appendLog, device, handleDisconnected, stopStreaming]);

  const startStreaming = useCallback(async () => {
    if (!server) {
      throw new Error('No active GATT connection. Call connect() before startStreaming().');
    }

    if (!notificationBindings.current.length) {
      appendLog('No characteristics selected for streaming – rediscovering services.');
      await discoverServices(server);
    }

    const updatedBindings: NotificationBinding[] = [];

    for (const binding of notificationBindings.current) {
      const { characteristic } = binding;

      const handler = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const dataView = target.value;
        if (!dataView) {
          appendLog(`Received empty packet from ${target.uuid}`);
          return;
        }

        const parsed = parseData(dataView, { device, characteristic: target });
        setLatestData(parsed);
        onData?.(parsed);
      };

      try {
        characteristic.addEventListener('characteristicvaluechanged', handler);
        if (characteristic.properties.notify || characteristic.properties.indicate) {
          await characteristic.startNotifications();
        } else {
          // Fallback poll for characteristics without notification support.
          const value = await characteristic.readValue();
          const parsed = parseData(value, { device, characteristic });
          setLatestData(parsed);
          onData?.(parsed);
        }

        appendLog(`Subscribed to characteristic ${characteristic.uuid}`);
        updatedBindings.push({ characteristic, handler });
      } catch (subscribeError) {
        appendLog(`Failed to subscribe to ${characteristic.uuid}: ${(subscribeError as Error).message}`);
      }
    }

    notificationBindings.current = updatedBindings;
    setIsStreaming(updatedBindings.length > 0);

    if (!updatedBindings.length) {
      appendLog('No characteristics are streaming. Check UUIDs and try again.');
    }
  }, [appendLog, device, discoverServices, onData, parseData, server]);

  // Automatically stop notifications when unmounting.
  useEffect(() => {
    return () => {
      stopStreaming().catch(() => undefined);
    };
  }, [stopStreaming]);

  return useMemo(
    () => ({
      isSupported,
      isConnecting,
      isConnected,
      isStreaming,
      device,
      server,
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
    }),
    [
      clearLogs,
      connect,
      device,
      discoveredServices,
      disconnect,
      error,
      isConnected,
      isConnecting,
      isStreaming,
      isSupported,
      latestData,
      logs,
      requestDevice,
      server,
      startStreaming,
      stopStreaming,
    ]
  );
}

export const BLAST_DEFAULTS = {
  SERVICE_UUIDS: DEFAULT_SERVICE_UUIDS,
  CHARACTERISTIC_UUIDS: DEFAULT_CHARACTERISTIC_UUIDS,
  NAME_PREFIXES: BLAST_NAME_PREFIXES,
};


