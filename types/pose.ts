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
}

export interface PoseKeypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}


