import type { DatabaseAdapter } from './adapter';
import * as firestore from '@/lib/firebase/firestore';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';
import type { Message, CreateMessageInput, Conversation } from '@/types/message';

export class FirestoreAdapter implements DatabaseAdapter {
  async getUser(uid: string): Promise<User | null> {
    return firestore.getUser(uid);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    return firestore.createUser(input);
  }

  async getUsersByTeam(teamId: string): Promise<User[]> {
    return firestore.getUsersByTeam(teamId);
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    return firestore.createSession(input);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return firestore.getSession(sessionId);
  }

  async getSessionsByUser(uid: string): Promise<Session[]> {
    return firestore.getSessionsByUser(uid);
  }

  async updateLeaderboard(
    teamId: string,
    uid: string,
    distanceFt: number,
    sessionId: string
  ): Promise<void> {
    return firestore.updateLeaderboard(teamId, uid, distanceFt, sessionId);
  }

  async getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]> {
    return firestore.getLeaderboardEntries(teamId);
  }

  async getSessionsByTeam(teamId: string): Promise<Session[]> {
    return firestore.getSessionsByTeam(teamId);
  }

  async createTeam(name: string, coachUid: string): Promise<Team> {
    return firestore.createTeam(name, coachUid);
  }

  async getTeam(teamId: string): Promise<Team | null> {
    return firestore.getTeam(teamId);
  }

  async getTeamsByUser(uid: string): Promise<Team[]> {
    return firestore.getTeamsByUser(uid);
  }

  async getAllTeams(): Promise<Team[]> {
    return firestore.getAllTeams();
  }

  async createMessage(senderUid: string, input: CreateMessageInput): Promise<Message> {
    return firestore.createMessage(senderUid, input);
  }

  async getMessages(uid1: string, uid2: string): Promise<Message[]> {
    return firestore.getMessages(uid1, uid2);
  }

  async getConversations(uid: string): Promise<Conversation[]> {
    return firestore.getConversations(uid);
  }

  async markMessagesAsRead(uid1: string, uid2: string, readerUid: string): Promise<void> {
    return firestore.markMessagesAsRead(uid1, uid2, readerUid);
  }
}


