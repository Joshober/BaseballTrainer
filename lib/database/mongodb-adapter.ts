import type { DatabaseAdapter } from './adapter';
import * as mongodb from '@/lib/mongodb/operations';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry } from '@/types/team';

export class MongodbAdapter implements DatabaseAdapter {
  async getUser(uid: string): Promise<User | null> {
    return mongodb.getUser(uid);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    return mongodb.createUser(input);
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    return mongodb.createSession(input);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return mongodb.getSession(sessionId);
  }

  async getSessionsByUser(uid: string): Promise<Session[]> {
    return mongodb.getSessionsByUser(uid);
  }

  async updateLeaderboard(
    teamId: string,
    uid: string,
    distanceFt: number,
    sessionId: string
  ): Promise<void> {
    return mongodb.updateLeaderboard(teamId, uid, distanceFt, sessionId);
  }

  async getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]> {
    return mongodb.getLeaderboardEntries(teamId);
  }
}

