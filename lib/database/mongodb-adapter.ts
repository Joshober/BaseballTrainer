import type { DatabaseAdapter } from './adapter';
import * as mongodb from '@/lib/mongodb/operations';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';
import type { Message, CreateMessageInput, Conversation } from '@/types/message';

export class MongodbAdapter implements DatabaseAdapter {
  async getUser(uid: string): Promise<User | null> {
    return mongodb.getUser(uid);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    return mongodb.createUser(input);
  }

  async updateUser(uid: string, updates: Partial<CreateUserInput>): Promise<User> {
    return mongodb.updateUser(uid, updates);
  }

  async getUsersByTeam(teamId: string): Promise<User[]> {
    return mongodb.getUsersByTeam(teamId);
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

  async getSessionsByTeam(teamId: string): Promise<Session[]> {
    return mongodb.getSessionsByTeam(teamId);
  }

  async createTeam(name: string, coachUid: string): Promise<Team> {
    return mongodb.createTeam(name, coachUid);
  }

  async getTeam(teamId: string): Promise<Team | null> {
    return mongodb.getTeam(teamId);
  }

  async getTeamsByUser(uid: string): Promise<Team[]> {
    return mongodb.getTeamsByUser(uid);
  }

  async getAllTeams(): Promise<Team[]> {
    return mongodb.getAllTeams();
  }

  async createMessage(senderUid: string, input: CreateMessageInput): Promise<Message> {
    return mongodb.createMessage(senderUid, input);
  }

  async getMessages(uid1: string, uid2: string): Promise<Message[]> {
    return mongodb.getMessages(uid1, uid2);
  }

  async getConversations(uid: string): Promise<Conversation[]> {
    return mongodb.getConversations(uid);
  }

  async markMessagesAsRead(uid1: string, uid2: string, readerUid: string): Promise<void> {
    return mongodb.markMessagesAsRead(uid1, uid2, readerUid);
  }
}

