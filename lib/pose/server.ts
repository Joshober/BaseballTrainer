import * as tf from '@tensorflow/tfjs-node';
import * as posedetection from '@tensorflow-models/pose-detection';
import { createCanvas, loadImage, Image } from 'canvas';
import type { PoseResult } from '@/types/pose';
import {
  normalizeAngle,
  calculateShoulderAngle,
  calculateHandLineAngle,
  estimateLaunchAngle,
  calculateConfidence,
  type KeypointMap,
} from './angles';
import { calculateBaseballSwingMetrics } from './baseball-detector';

let detector: posedetection.PoseDetector | null = null;

async function getDetector(): Promise<posedetection.PoseDetector> {
  if (!detector) {
    // Use MoveNet Thunder for better accuracy on server-side
    try {
      detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        { modelType: posedetection.movenet.modelType.SINGLEPOSE_THUNDER }
      );
    } catch (error) {
      console.warn('Failed to load Thunder model, falling back to Lightning:', error);
      detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
    }
  }
  return detector;
}

function hasConfidence(keypoints: KeypointMap, names: string[], threshold = 0.4): boolean {
  return names.every((name) => (keypoints[name]?.score ?? 0) > threshold);
}

export async function estimateAnglesFromImageBuffer(
  imageBuffer: Buffer
): Promise<PoseResult> {
  try {
    const detector = await getDetector();
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const poses = await detector.estimatePoses(canvas as any, { flipHorizontal: false });

    if (!poses.length || !poses[0].keypoints) {
      return { ok: false };
    }

    const keypoints = poses[0].keypoints;
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

    // Shoulder line angle (torso proxy)
    let shoulderAngle: number | null = null;
    if (hasConfidence(kpMap, ['left_shoulder', 'right_shoulder'])) {
      shoulderAngle = calculateShoulderAngle(kpMap['left_shoulder'], kpMap['right_shoulder']);
    }

    // Forearm/hand line angle (bat path proxy via wrist-elbow)
    let handLineAngle: number | null = null;
    const leftOK = hasConfidence(kpMap, ['left_elbow', 'left_wrist']);
    const rightOK = hasConfidence(kpMap, ['right_elbow', 'right_wrist']);

    if (leftOK || rightOK) {
      const side = rightOK ? 'right' : 'left';
      handLineAngle = calculateHandLineAngle(
        kpMap[`${side}_elbow`],
        kpMap[`${side}_wrist`]
      );
    }

    // Calculate baseball-specific metrics
    const baseballMetrics = calculateBaseballSwingMetrics(keypoints.map((kp) => ({
      name: kp.name || '',
      x: kp.x,
      y: kp.y,
      score: kp.score || 0,
    })));

    // Use baseball metrics if available, otherwise fallback to generic
    const launchAngleEst = baseballMetrics?.launchAngle || estimateLaunchAngle(shoulderAngle, handLineAngle);
    const attackAngleEst = baseballMetrics?.attackAngle || handLineAngle;
    const confidence = baseballMetrics?.confidence || calculateConfidence(keypoints.map((kp) => ({
      name: kp.name || '',
      x: kp.x,
      y: kp.y,
      score: kp.score || 0,
    })));

    return {
      ok: true,
      launchAngleEst,
      attackAngleEst,
      confidence,
      keypoints: keypoints.map((kp) => ({
        name: kp.name || '',
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
      })),
      // Add baseball-specific data if available
      ...(baseballMetrics && {
        baseballMetrics: {
          batPathAngle: baseballMetrics.batPathAngle,
          hipRotation: baseballMetrics.hipRotation,
          shoulderRotation: baseballMetrics.shoulderRotation,
          phase: baseballMetrics.phase,
        },
      }),
    };
  } catch (error) {
    console.error('Server-side pose detection error:', error);
    return { ok: false };
  }
}


