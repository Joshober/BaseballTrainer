/**
 * Baseball-specific pose detection enhancements
 * 
 * This module provides baseball swing-specific keypoint analysis
 * and angle calculations optimized for hitting mechanics.
 */

import type { PoseKeypoint } from '@/types/pose';
import {
  calculateShoulderAngle,
  calculateHandLineAngle,
  estimateLaunchAngle,
  type KeypointMap,
} from './angles';

export interface BaseballSwingMetrics {
  launchAngle: number;
  attackAngle: number;
  batPathAngle: number;
  hipRotation: number;
  shoulderRotation: number;
  confidence: number;
  phase: 'setup' | 'load' | 'stride' | 'contact' | 'follow-through';
}

/**
 * Calculate bat path angle using hand and wrist positions
 * This is more accurate for baseball than generic hand line
 */
export function calculateBatPathAngle(
  leftWrist: PoseKeypoint | undefined,
  rightWrist: PoseKeypoint | undefined,
  leftElbow: PoseKeypoint | undefined,
  rightElbow: PoseKeypoint | undefined
): number | null {
  // Use the side that's more visible (higher confidence)
  const leftScore = (leftWrist?.score || 0) + (leftElbow?.score || 0);
  const rightScore = (rightWrist?.score || 0) + (rightElbow?.score || 0);

  // For bat path, we want the angle from elbow to wrist (representing the bat)
  if (leftScore > rightScore && leftElbow && leftWrist) {
    return calculateHandLineAngle(leftElbow, leftWrist);
  } else if (rightElbow && rightWrist) {
    return calculateHandLineAngle(rightElbow, rightWrist);
  }

  return null;
}

/**
 * Calculate hip rotation angle (important for power generation)
 */
export function calculateHipRotation(
  leftHip: PoseKeypoint | undefined,
  rightHip: PoseKeypoint | undefined,
  leftShoulder: PoseKeypoint | undefined,
  rightShoulder: PoseKeypoint | undefined
): number | null {
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) {
    return null;
  }

  // Calculate hip line angle
  const hipAngle = (Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x) * 180) / Math.PI;
  
  // Calculate shoulder line angle
  const shoulderAngle = calculateShoulderAngle(leftShoulder, rightShoulder);
  if (shoulderAngle === null) return null;

  // Rotation is the difference between hip and shoulder angles
  return Math.abs(hipAngle - shoulderAngle);
}

/**
 * Detect swing phase based on keypoint positions
 */
export function detectSwingPhase(keypoints: PoseKeypoint[]): BaseballSwingMetrics['phase'] {
  const kpMap: KeypointMap = {};
  keypoints.forEach((kp) => {
    if (kp.name) {
      kpMap[kp.name] = {
        name: kp.name,
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
      };
    }
  });

  const leftWrist = kpMap['left_wrist'];
  const rightWrist = kpMap['right_wrist'];
  const leftElbow = kpMap['left_elbow'];
  const rightElbow = kpMap['right_elbow'];

  if (!leftWrist || !rightWrist) return 'setup';

  // Simple heuristic: if wrists are high, likely in load/stride
  // If wrists are low and forward, likely in contact/follow-through
  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgElbowY = leftElbow && rightElbow ? (leftElbow.y + rightElbow.y) / 2 : avgWristY;

  if (avgWristY < avgElbowY) {
    return 'load'; // Wrists above elbows
  } else if (leftWrist.x > rightWrist.x) {
    return 'follow-through'; // Left wrist forward (for right-handed swing)
  } else {
    return 'contact'; // Wrists at similar level, likely contact
  }
}

/**
 * Calculate comprehensive baseball swing metrics
 */
export function calculateBaseballSwingMetrics(
  keypoints: PoseKeypoint[]
): BaseballSwingMetrics | null {
  const kpMap: KeypointMap = {};
  keypoints.forEach((kp) => {
    if (kp.name) {
      kpMap[kp.name] = {
        name: kp.name,
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
      };
    }
  });

  // Required keypoints for baseball analysis
  const required = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'];
  const hasRequired = required.every((name) => kpMap[name] && (kpMap[name]?.score || 0) > 0.3);

  if (!hasRequired) {
    return null;
  }

  // Calculate angles
  const shoulderAngle = calculateShoulderAngle(kpMap['left_shoulder'], kpMap['right_shoulder']);
  const handLineAngle = calculateHandLineAngle(
    kpMap['right_elbow'] || kpMap['left_elbow'],
    kpMap['right_wrist'] || kpMap['left_wrist']
  );
  const batPathAngle = calculateBatPathAngle(
    kpMap['left_wrist'],
    kpMap['right_wrist'],
    kpMap['left_elbow'],
    kpMap['right_elbow']
  );
  const hipRotation = calculateHipRotation(
    kpMap['left_hip'],
    kpMap['right_hip'],
    kpMap['left_shoulder'],
    kpMap['right_shoulder']
  );

  // Estimate launch angle
  const launchAngle = estimateLaunchAngle(shoulderAngle, handLineAngle || batPathAngle);

  // Calculate confidence
  const confidence = keypoints.reduce((sum, kp) => sum + (kp.score || 0), 0) / keypoints.length;

  // Detect phase
  const phase = detectSwingPhase(keypoints);

  return {
    launchAngle,
    attackAngle: handLineAngle || batPathAngle || null,
    batPathAngle: batPathAngle || handLineAngle || null,
    hipRotation: hipRotation || null,
    shoulderRotation: shoulderAngle || null,
    confidence,
    phase,
  };
}

