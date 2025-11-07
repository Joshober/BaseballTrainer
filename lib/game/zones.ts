export interface Zone {
  name: string;
  min: number;
  max: number;
  milestone: string;
}

export const ZONES: Zone[] = [
  { name: 'Atmosphere', min: 0, max: 300, milestone: 'Breaking through!' },
  { name: 'Low Earth Orbit', min: 300, max: 1000, milestone: 'Orbit achieved!' },
  { name: 'Moon', min: 1000, max: 6000, milestone: 'Moon bound!' },
  { name: 'Mars', min: 6000, max: 35000, milestone: 'Mars mission!' },
  { name: 'Beyond', min: 35000, max: Infinity, milestone: 'Interstellar!' },
];

export function getZone(distanceFt: number): Zone {
  return ZONES.find((zone) => distanceFt >= zone.min && distanceFt < zone.max) || ZONES[ZONES.length - 1];
}

export function getMilestone(distanceFt: number): string {
  return getZone(distanceFt).milestone;
}

export function getProgressToNext(distanceFt: number): number {
  const zone = getZone(distanceFt);
  if (zone.max === Infinity) return 1;
  const progress = (distanceFt - zone.min) / (zone.max - zone.min);
  return Math.min(1, Math.max(0, progress));
}

export function getVelocityFeedback(exitVelocity: number): string {
  if (exitVelocity < 70) {
    return 'Not enough thrust to break gravity.';
  } else if (exitVelocity < 90) {
    return 'Entering upper atmosphere.';
  } else if (exitVelocity < 105) {
    return 'Orbit achieved!';
  } else {
    return 'You slingshotted toward the Moon!';
  }
}

