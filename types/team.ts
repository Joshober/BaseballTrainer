export interface Team {
  id: string;
  name: string;
  coachUid: string;
  createdAt?: Date | string;
}

export interface LeaderboardEntry {
  uid: string;
  teamId: string;
  bestDistanceFt: number;
  bestSessionId: string;
  updatedAt: Date | string;
  displayName?: string;
}


