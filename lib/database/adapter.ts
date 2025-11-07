import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';
import type { Message, CreateMessageInput, Conversation } from '@/types/message';

export interface DatabaseAdapter {
  getUser(uid: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  getUsersByTeam(teamId: string): Promise<User[]>;
  createSession(input: CreateSessionInput): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessionsByUser(uid: string): Promise<Session[]>;
  getSessionsByTeam(teamId: string): Promise<Session[]>;
  updateLeaderboard(teamId: string, uid: string, distanceFt: number, sessionId: string): Promise<void>;
  getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]>;
  createTeam(name: string, coachUid: string): Promise<Team>;
  getTeam(teamId: string): Promise<Team | null>;
  getTeamsByUser(uid: string): Promise<Team[]>;
  getAllTeams(): Promise<Team[]>;
  createMessage(senderUid: string, input: CreateMessageInput): Promise<Message>;
  getMessages(uid1: string, uid2: string): Promise<Message[]>;
  getConversations(uid: string): Promise<Conversation[]>;
  markMessagesAsRead(uid1: string, uid2: string, readerUid: string): Promise<void>;
}


