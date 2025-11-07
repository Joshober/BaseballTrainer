export type SwingLabel = 'good' | 'needs_work';

export function classifySwing(launchAngleEst: number, exitVelocity: number): SwingLabel {
  // Rule: launchAngleEst in [25°, 35°] AND exitVelocity ≥ 90 mph → "good"
  const angleInRange = launchAngleEst >= 25 && launchAngleEst <= 35;
  const velocitySufficient = exitVelocity >= 90;
  
  if (angleInRange && velocitySufficient) {
    return 'good';
  }
  return 'needs_work';
}


