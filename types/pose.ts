export interface PoseResult {
  ok: boolean;
  launchAngleEst?: number;
  attackAngleEst?: number | null;
  confidence?: number;
  keypoints?: Array<{
    name: string;
    x: number;
    y: number;
    score: number;
  }>;
  baseballMetrics?: {
    batPathAngle: number | null;
    hipRotation: number | null;
    shoulderRotation: number | null;
    phase: 'setup' | 'load' | 'stride' | 'contact' | 'follow-through';
  };
}

export interface PoseKeypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}


