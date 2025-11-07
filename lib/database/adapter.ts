import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry } from '@/types/team';

export interface DatabaseAdapter {
  getUser(uid: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  createSession(input: CreateSessionInput): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessionsByUser(uid: string): Promise<Session[]>;
  updateLeaderboard(teamId: string, uid: string, distanceFt: number, sessionId: string): Promise<void>;
  getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]>;
}


