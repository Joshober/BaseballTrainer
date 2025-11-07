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
}

