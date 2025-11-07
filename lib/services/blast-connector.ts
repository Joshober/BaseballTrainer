/**
 * Blast Connector service client
 * Provides functions to interact with the Blast Connector API
 * Routes through the main backend gateway
 */
import { getBackendUrl } from '@/lib/utils/backend-url';

export interface BlastData {
  deviceId?: string;
  batSpeed?: number;
  attackAngle?: number;
  timeToContact?: number;
  power?: number;
  handSpeed?: number;
  onPlane?: boolean;
  verticalBatAngle?: number;
  connection?: number;
  [key: string]: any;
}

export interface BlastSession {
  _id: string;
  sessionId: string;
  userId: string;
  deviceId: string;
  mainSessionId?: string;
  createdAt: string;
  updatedAt: string;
  latestData?: {
    metrics: Record<string, any>;
    createdAt: string;
  };
  data?: BlastData[];
  aggregatedMetrics?: Record<string, any>;
}

/**
 * Connect to Blast Motion device
 */
export async function connectBlastDevice(
  deviceId: string,
  apiKey: string,
  authToken: string
): Promise<{ success: boolean; connection: any }> {
  const url = `${getBackendUrl()}/api/blast/connect`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ deviceId, apiKey }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to connect device: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Send Blast data to the connector
 */
export async function sendBlastData(
  sessionId: string,
  data: BlastData,
  authToken: string
): Promise<{ success: boolean; saved: any }> {
  const url = `${getBackendUrl()}/api/blast/data`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ sessionId, data }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get all Blast sessions for the user
 */
export async function getBlastSessions(
  limit: number = 10,
  offset: number = 0,
  authToken: string
): Promise<{ success: boolean; sessions: BlastSession[]; count: number }> {
  const url = `${getBackendUrl()}/api/blast/sessions?limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get sessions: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get a specific Blast session
 */
export async function getBlastSession(
  sessionId: string,
  authToken: string
): Promise<{ success: boolean; session: BlastSession }> {
  const url = `${getBackendUrl()}/api/blast/sessions/${sessionId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Sync Blast session with main project session
 */
export async function syncBlastSession(
  blastSessionId: string,
  mainSessionId: string,
  authToken: string
): Promise<{ success: boolean; sync: any }> {
  const url = `${getBackendUrl()}/api/blast/sync/session`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ blastSessionId, mainSessionId }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync session: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Sync Blast metrics with pose detection results
 */
export async function syncBlastMetrics(
  sessionId: string,
  poseMetrics: Record<string, any>,
  blastMetrics: Record<string, any>,
  authToken: string
): Promise<{ success: boolean; combined: any }> {
  const url = `${getBackendUrl()}/api/blast/sync/metrics`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ sessionId, poseMetrics, blastMetrics }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync metrics: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Compare Blast data with pose detection results
 */
export async function compareBlastWithPose(
  sessionId: string,
  authToken: string
): Promise<{ success: boolean; comparison: any }> {
  const url = `${getBackendUrl()}/api/blast/sync/compare`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to compare data: ${response.statusText}`);
  }
  
  return response.json();
}

