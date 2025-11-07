export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: 'player' | 'coach';
  teamId?: string;
  createdAt: Date | string;
}

export interface CreateUserInput {
  uid: string;
  displayName: string;
  email: string;
  role: 'player' | 'coach';
  teamId?: string;
}


