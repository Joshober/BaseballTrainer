#!/usr/bin/env tsx
/**
 * Install and cache AI models for the baseball swing analysis app
 * 
 * This script pre-downloads and caches the TensorFlow.js MoveNet models
 * so they're ready for use without waiting for first-time downloads.
 * 
 * Models installed:
 * - MoveNet Lightning (~5MB) - Fast, lightweight model for client-side
 * - MoveNet Thunder (~12MB) - More accurate model for server-side
 */

import * as tf from '@tensorflow/tfjs-node';
import * as posedetection from '@tensorflow-models/pose-detection';
import { createCanvas } from 'canvas';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string) {
  log(`[${step}/${total}] ${message}`, 'cyan');
}

async function installModel(
  modelType: posedetection.movenet.modelType,
  modelName: string
): Promise<boolean> {
  try {
    logStep(1, 2, `Installing ${modelName}...`);
    log(`  Downloading model files (~${modelName === 'Lightning' ? '5' : '12'}MB)...`, 'yellow');
    
    const startTime = Date.now();
    
    // Create detector - this will download and cache the model
    const detector = await posedetection.createDetector(
      posedetection.SupportedModels.MoveNet,
      { 
        modelType,
        enableSmoothing: false,
      }
    );
    
    // Test the model with a dummy image to ensure it's fully loaded
    log(`  Testing model with dummy image...`, 'yellow');
    const testCanvas = createCanvas(256, 256);
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    
    // Run inference to ensure model is fully loaded
    await detector.estimatePoses(testCanvas as any, { 
      flipHorizontal: false,
      maxPoses: 1,
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`  ✓ ${modelName} installed successfully (${elapsed}s)`, 'green');
    
    return true;
  } catch (error: any) {
    log(`  ✗ Failed to install ${modelName}: ${error?.message || error}`, 'red');
    if (error?.stack) {
      log(`  Stack: ${error.stack}`, 'red');
    }
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'bright');
  log('  AI Models Installation Script', 'bright');
  log('  Baseball Swing Analysis App', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  log('This script will download and cache the following models:', 'blue');
  log('  • MoveNet Lightning (~5MB) - Fast, lightweight', 'blue');
  log('  • MoveNet Thunder (~12MB) - More accurate\n', 'blue');

  // Ensure TensorFlow.js Node backend is registered
  log('Initializing TensorFlow.js Node backend...', 'yellow');
  await tf.ready();
  log('  ✓ TensorFlow.js Node backend ready\n', 'green');

  const results = {
    lightning: false,
    thunder: false,
  };

  // Install MoveNet Lightning
  logStep(1, 2, 'Installing MoveNet Lightning (client-side model)');
  results.lightning = await installModel(
    posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    'Lightning'
  );

  // Install MoveNet Thunder
  logStep(2, 2, 'Installing MoveNet Thunder (server-side model)');
  results.thunder = await installModel(
    posedetection.movenet.modelType.SINGLEPOSE_THUNDER,
    'Thunder'
  );

  // Summary
  log('\n' + '='.repeat(60), 'bright');
  log('  Installation Summary', 'bright');
  log('='.repeat(60), 'bright');
  
  log(`\nMoveNet Lightning: ${results.lightning ? '✓ Installed' : '✗ Failed'}`, 
    results.lightning ? 'green' : 'red');
  log(`MoveNet Thunder:   ${results.thunder ? '✓ Installed' : '✗ Failed'}`, 
    results.thunder ? 'green' : 'red');

  if (results.lightning && results.thunder) {
    log('\n✓ All models installed successfully!', 'green');
    log('  Models are now cached and ready to use.', 'green');
    log('  First-time usage will be faster now.\n', 'green');
    process.exit(0);
  } else {
    log('\n⚠ Some models failed to install.', 'yellow');
    log('  The app will still work, but models will download on first use.', 'yellow');
    log('  Check your internet connection and try again.\n', 'yellow');
    process.exit(1);
  }
}

// Run the installation
main().catch((error) => {
  log(`\n✗ Fatal error: ${error}`, 'red');
  process.exit(1);
});

