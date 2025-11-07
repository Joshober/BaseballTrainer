// Try to import TensorFlow.js Node, but make it optional (Windows native bindings issue)
let tf: any = null;
let posedetection: any = null;
let tfjsNodeAvailable = false;

try {
  tf = require('@tensorflow/tfjs-node');
  posedetection = require('@tensorflow-models/pose-detection');
  tfjsNodeAvailable = true;
  console.log('✅ TensorFlow.js Node loaded successfully');
} catch (error: any) {
  console.warn('⚠️  TensorFlow.js Node not available (native bindings issue).');
  console.warn('   This is common on Windows. Server-side pose detection will be disabled.');
  console.warn('   Client-side pose detection will still work in the browser.');
  console.warn(`   Error: ${error.message}`);
  tfjsNodeAvailable = false;
}

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
import { detectBatLine, getHandRegion } from './bat-detector';

let detector: posedetection.PoseDetector | null = null;
let tfReady = false;

async function ensureTensorFlowReady(): Promise<void> {
  if (!tfjsNodeAvailable || !tf) {
    throw new Error('TensorFlow.js Node is not available. Server-side pose detection is disabled.');
  }
  if (!tfReady) {
    await tf.ready();
    tfReady = true;
  }
}

async function getDetector(): Promise<posedetection.PoseDetector> {
  if (!detector) {
    // Ensure TensorFlow.js backend is initialized
    await ensureTensorFlowReady();
    
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
    // Check if TensorFlow.js Node is available
    if (!tfjsNodeAvailable || !tf || !posedetection) {
      console.warn('Server-side pose detection not available. Returning error result.');
      return { ok: false };
    }
    
    // Ensure TensorFlow.js is ready before using detector
    await ensureTensorFlowReady();
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

    // Try to detect bat line for more accurate angle
    let batAngle: number | null = null;
    try {
      const handRegion = getHandRegion(keypoints.map((kp) => ({
        name: kp.name || '',
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
      })));

      if (handRegion) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const batLine = detectBatLine(imageData, handRegion);
        if (batLine && batLine.confidence > 0.3) {
          batAngle = batLine.angle;
        }
      }
    } catch (error) {
      console.warn('Bat detection failed:', error);
    }

    // Use bat angle if detected, otherwise use baseball metrics or fallback
    const finalAttackAngle = batAngle !== null ? batAngle : (baseballMetrics?.attackAngle || handLineAngle);
    const launchAngleEst = baseballMetrics?.launchAngle || estimateLaunchAngle(shoulderAngle, finalAttackAngle || handLineAngle);
    const attackAngleEst = finalAttackAngle;
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


