export interface VideoAnalysis {
  ok: boolean;
  videoInfo?: {
    fps: number;
    frameCount: number;
    duration: number;
    width: number;
    height: number;
  };
  contactFrame?: number | null;
  contact?: {
    frame: number;
    confidence: number;
    angular_velocity: number;
    proximity?: number | null;
    velocity_change?: number | null;
    timestamp: number;
  } | null;
  metrics?: {
    batAngularVelocity: number;
    batLinearSpeed: number;
    batLinearSpeedMph: number;
    exitVelocityEstimate: number;
    exitVelocityEstimateMph: number;
    exitVelocityErrorMargin: number;
    launchAngle: number;
  };
  formAnalysis?: {
    hip_rotation?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    shoulder_separation?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    front_knee_flex?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    stride_length?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    spine_tilt?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    elbow_extension?: {
      value: number;
      ideal: [number, number];
      deviation: number;
    };
    feedback: string[];
  };
  frames?: Array<{
    frameIndex: number;
    timestamp: number;
    pose?: any;
    batAngle?: number | null;
    batPosition?: [number, number] | null;
    ball?: {
      center: [number, number];
      radius: number;
      confidence: number;
      velocity?: number;
      tracked?: boolean;
    } | null;
  }>;
  visualization?: {
    skeletonOverlay: boolean;
    batLine: boolean;
    contactHighlight: boolean;
  };
  swingPhases?: Array<{
    phase: string;
    startFrame: number;
    endFrame: number;
  }> | {
    phases: Array<{
      phase: string;
      startFrame: number;
      endFrame: number;
    }>;
    key_frames?: any;
    phase_duration?: any;
    phase_transitions?: any;
    swing_quality?: any;
  };
  biomechanics?: {
    maxHipRotation?: number;
    maxShoulderRotation?: number;
    weightTransfer?: number;
    [key: string]: any;
  };
  formErrors?: Array<{
    type?: string;
    error?: string;
    description?: string;
    impact?: string;
    recommendation?: string;
    severity?: number | string;
    frame?: number;
  }> | {
    errors: Array<{
      type?: string;
      error?: string;
      description?: string;
      impact?: string;
      recommendation?: string;
      severity?: number | string;
      frame?: number;
    }>;
    recommendations?: string[];
    error_count?: number;
    severity_score?: number;
  };
  trackingQuality?: {
    overallScore: number;
    personTrackingRatio: number;
    batTrackingRatio: number;
    ballTrackingRatio: number;
  };
  trackingTrajectories?: any;
  error?: string;
}

export interface Session {
  id: string;
  uid: string;
  teamId: string;
  photoPath: string;
  photoURL?: string;
  videoPath?: string;
  videoURL?: string;
  createdAt: Date | string;
  metrics: {
    launchAngleEst: number;
    attackAngleEst: number | null;
    exitVelocity: number;
    confidence: number;
  };
  game: {
    distanceFt: number;
    zone: string;
    milestone: string;
    progressToNext: number;
  };
  label: 'good' | 'needs_work';
  videoAnalysis?: VideoAnalysis;
  recommendations?: any; // drill recommendations
}

export interface CreateSessionInput {
  uid: string;
  teamId: string;
  photoPath: string;
  photoURL?: string;
  videoPath?: string;
  videoURL?: string;
  metrics: Session['metrics'];
  game: Session['game'];
  label: Session['label'];
  videoAnalysis?: VideoAnalysis;
}

export interface GeminiDrill {
  name: string;
  description: string;
  youtubeUrl: string;
  rationale?: string;
}


