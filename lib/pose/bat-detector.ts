/**
 * Bat detection using Hough line detection on high-contrast edges
 * Detects bat lines in images to improve angle calculations
 */

import type { PoseKeypoint } from '@/types/pose';

export interface BatLine {
  angle: number;
  confidence: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

/**
 * Detect bat line using Hough transform on high-contrast edges
 * This analyzes the region near the hands/wrists for bat-like lines
 */
export function detectBatLine(
  imageData: ImageData,
  handRegion: { x: number; y: number; width: number; height: number }
): BatLine | null {
  // Crop to hand region
  const cropX = Math.max(0, Math.floor(handRegion.x));
  const cropY = Math.max(0, Math.floor(handRegion.y));
  const cropWidth = Math.min(imageData.width - cropX, Math.floor(handRegion.width));
  const cropHeight = Math.min(imageData.height - cropY, Math.floor(handRegion.height));

  if (cropWidth <= 0 || cropHeight <= 0) return null;

  // Extract region of interest
  const roi = extractROI(imageData, cropX, cropY, cropWidth, cropHeight);
  
  // Apply edge detection (Sobel or Canny-like)
  const edges = detectEdges(roi);
  
  // Apply Hough line transform
  const lines = houghLineTransform(edges, cropWidth, cropHeight);
  
  if (lines.length === 0) return null;

  // Find the most prominent line (likely the bat)
  const bestLine = lines.reduce((best, line) => 
    line.confidence > best.confidence ? line : best
  );

  // Adjust coordinates back to full image space
  return {
    angle: bestLine.angle,
    confidence: bestLine.confidence,
    startPoint: {
      x: bestLine.startPoint.x + cropX,
      y: bestLine.startPoint.y + cropY,
    },
    endPoint: {
      x: bestLine.endPoint.x + cropX,
      y: bestLine.endPoint.y + cropY,
    },
  };
}

/**
 * Extract region of interest from image data
 */
function extractROI(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData {
  const roi = new ImageData(width, height);
  const sourceData = imageData.data;
  const targetData = roi.data;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const sourceIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const targetIdx = (row * width + col) * 4;

      targetData[targetIdx] = sourceData[sourceIdx]; // R
      targetData[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
      targetData[targetIdx + 2] = sourceData[sourceIdx + 2]; // B
      targetData[targetIdx + 3] = sourceData[sourceIdx + 3]; // A
    }
  }

  return roi;
}

/**
 * Simple edge detection using Sobel operator
 */
function detectEdges(imageData: ImageData): Uint8Array {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const edges = new Uint8Array(width * height);

  // Convert to grayscale and apply Sobel
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Grayscale
      const gray = (data[idx * 4] + data[idx * 4 + 1] + data[idx * 4 + 2]) / 3;
      
      // Sobel X
      const sobelX = 
        -data[((y - 1) * width + (x - 1)) * 4] +
        data[((y - 1) * width + (x + 1)) * 4] +
        -2 * data[(y * width + (x - 1)) * 4] +
        2 * data[(y * width + (x + 1)) * 4] +
        -data[((y + 1) * width + (x - 1)) * 4] +
        data[((y + 1) * width + (x + 1)) * 4];
      
      // Sobel Y
      const sobelY = 
        -data[((y - 1) * width + (x - 1)) * 4] +
        -2 * data[((y - 1) * width + x) * 4] +
        -data[((y - 1) * width + (x + 1)) * 4] +
        data[((y + 1) * width + (x - 1)) * 4] +
        2 * data[((y + 1) * width + x) * 4] +
        data[((y + 1) * width + (x + 1)) * 4];
      
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[idx] = magnitude > 50 ? 255 : 0; // Threshold
    }
  }

  return edges;
}

/**
 * Simplified Hough line transform
 */
function houghLineTransform(
  edges: Uint8Array,
  width: number,
  height: number
): Array<{ angle: number; confidence: number; startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> {
  const lines: Array<{ angle: number; confidence: number; startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> = [];
  const maxDistance = Math.sqrt(width * width + height * height);
  const angleStep = Math.PI / 180; // 1 degree steps
  const houghSpace: { [key: string]: number } = {};

  // Accumulate votes in Hough space
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] === 255) {
        // For each angle, calculate rho
        for (let theta = 0; theta < Math.PI; theta += angleStep) {
          const rho = x * Math.cos(theta) + y * Math.sin(theta);
          const key = `${Math.round(theta * 180 / Math.PI)}_${Math.round(rho)}`;
          houghSpace[key] = (houghSpace[key] || 0) + 1;
        }
      }
    }
  }

  // Find peaks in Hough space (lines with most votes)
  const threshold = 10; // Minimum votes for a line
  for (const [key, votes] of Object.entries(houghSpace)) {
    if (votes >= threshold) {
      const [thetaDeg, rho] = key.split('_').map(Number);
      const theta = (thetaDeg * Math.PI) / 180;

      // Calculate line endpoints
      let x1 = 0, y1 = 0, x2 = width, y2 = height;

      if (Math.abs(Math.sin(theta)) > 0.001) {
        y1 = (rho - x1 * Math.cos(theta)) / Math.sin(theta);
        y2 = (rho - x2 * Math.cos(theta)) / Math.sin(theta);
      } else {
        x1 = rho / Math.cos(theta);
        x2 = rho / Math.cos(theta);
      }

      lines.push({
        angle: thetaDeg,
        confidence: votes / 100, // Normalize confidence
        startPoint: { x: x1, y: y1 },
        endPoint: { x: x2, y: y2 },
      });
    }
  }

  return lines;
}

/**
 * Get hand region from pose keypoints for bat detection
 */
export function getHandRegion(keypoints: PoseKeypoint[]): { x: number; y: number; width: number; height: number } | null {
  const leftWrist = keypoints.find((kp) => kp.name === 'left_wrist');
  const rightWrist = keypoints.find((kp) => kp.name === 'right_wrist');
  const leftElbow = keypoints.find((kp) => kp.name === 'left_elbow');
  const rightElbow = keypoints.find((kp) => kp.name === 'right_elbow');

  if (!leftWrist && !rightWrist) return null;

  const wrists = [leftWrist, rightWrist].filter(Boolean) as PoseKeypoint[];
  const elbows = [leftElbow, rightElbow].filter(Boolean) as PoseKeypoint[];

  const allPoints = [...wrists, ...elbows];
  if (allPoints.length === 0) return null;

  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = Math.min(...allPoints.map((p) => p.y));
  const maxY = Math.max(...allPoints.map((p) => p.y));

  // Expand region by 50% to include bat
  const width = (maxX - minX) * 1.5;
  const height = (maxY - minY) * 1.5;
  const x = Math.max(0, minX - width * 0.25);
  const y = Math.max(0, minY - height * 0.25);

  return { x, y, width, height };
}

