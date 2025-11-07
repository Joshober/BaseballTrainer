export function calculateDistance(exitVelocity: number, launchAngleDegrees: number): number {
  // Convert angle to radians
  const launchAngleRadians = (launchAngleDegrees * Math.PI) / 180;
  
  // Formula: distanceFt = (exitVelocity^2 / 32.174) * sin(2 * launchAngleRadians)
  // 32.174 is acceleration due to gravity in ft/s^2
  const distanceFt = (Math.pow(exitVelocity, 2) / 32.174) * Math.sin(2 * launchAngleRadians);
  
  return Math.max(0, distanceFt); // Ensure non-negative
}

