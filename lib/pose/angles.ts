import type { PoseKeypoint } from '@/types/pose';

export interface KeypointMap {
  [key: string]: PoseKeypoint | undefined;
}

export function normalizeAngle(angle: number | null): number | null {
  if (angle === null) return null;
  return Math.abs(((angle + 360) % 180) - 90);
}

export function calculateShoulderAngle(
  leftShoulder: PoseKeypoint | undefined,
  rightShoulder: PoseKeypoint | undefined
): number | null {
  if (!leftShoulder || !rightShoulder) return null;
  return (Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180) / Math.PI;
}

export function calculateHandLineAngle(
  elbow: PoseKeypoint | undefined,
  wrist: PoseKeypoint | undefined
): number | null {
  if (!elbow || !wrist) return null;
  return (Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) * 180) / Math.PI;
}

export function estimateLaunchAngle(
  shoulderAngle: number | null,
  handLineAngle: number | null
): number {
  const normShoulder = normalizeAngle(shoulderAngle);
  const normHand = normalizeAngle(handLineAngle);

  if (normShoulder !== null && normHand !== null) {
    return 0.4 * normShoulder + 0.6 * normHand; // weight hands more
  }
  if (normHand !== null) {
    return normHand;
  }
  return normShoulder ?? 28; // fallback typical value
}

export function calculateConfidence(keypoints: PoseKeypoint[]): number {
  if (keypoints.length === 0) return 0;
  const totalScore = keypoints.reduce((sum, kp) => sum + (kp.score || 0), 0);
  return totalScore / keypoints.length;
}


