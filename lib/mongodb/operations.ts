import { getMongoDb } from './client';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';

// Users
export async function getUser(uid: string): Promise<User | null> {
  const db = await getMongoDb();
  const user = await db.collection('users').findOne({ uid });
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    teamId: user.teamId || undefined,
    createdAt: user.createdAt || new Date(),
  } as User;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = await getMongoDb();
  const user = {
    uid: input.uid,
    displayName: input.displayName,
    email: input.email,
    teamId: input.teamId || null,
    createdAt: new Date(),
  };
  await db.collection('users').insertOne(user);
  return getUser(input.uid) as Promise<User>;
}

// Sessions
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const db = await getMongoDb();
  const session = {
    id: crypto.randomUUID(),
    uid: input.uid,
    teamId: input.teamId,
    photoPath: input.photoPath,
    photoURL: input.photoURL || null,
    videoPath: input.videoPath || null,
    videoURL: input.videoURL || null,
    metrics: input.metrics,
    game: input.game,
    label: input.label,
    createdAt: new Date(),
  };
  await db.collection('sessions').insertOne(session);
  return session as Session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = await getMongoDb();
  const session = await db.collection('sessions').findOne({ id: sessionId });
  if (!session) return null;
  return session as Session;
}

export async function getSessionsByUser(uid: string): Promise<Session[]> {
  const db = await getMongoDb();
  const sessions = await db.collection('sessions').find({ uid }).toArray();
  return sessions as Session[];
}

// Leaderboard
export async function updateLeaderboard(
  teamId: string,
  uid: string,
  distanceFt: number,
  sessionId: string
): Promise<void> {
  const db = await getMongoDb();
  const entry = await db.collection('leaderboardEntries').findOne({ teamId, uid });
  const best = entry ? (entry.bestDistanceFt || 0) : 0;
  if (distanceFt > best) {
    await db.collection('leaderboardEntries').updateOne(
      { teamId, uid },
      {
        $set: {
          bestDistanceFt: distanceFt,
          bestSessionId: sessionId,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}

export async function getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]> {
  const db = await getMongoDb();
  const entries = await db.collection('leaderboardEntries')
    .find({ teamId })
    .sort({ bestDistanceFt: -1 })
    .toArray();
  return entries.map((entry) => ({
    uid: entry.uid,
    teamId: entry.teamId,
    bestDistanceFt: entry.bestDistanceFt,
    bestSessionId: entry.bestSessionId,
    updatedAt: entry.updatedAt || new Date(),
  })) as LeaderboardEntry[];
}

// Teams
export async function createTeam(name: string, coachUid: string): Promise<Team> {
  const db = await getMongoDb();
  const team = {
    id: crypto.randomUUID(),
    name,
    coachUid,
    createdAt: new Date(),
  };
  await db.collection('teams').insertOne(team);
  return team as Team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const db = await getMongoDb();
  const team = await db.collection('teams').findOne({ id: teamId });
  if (!team) return null;
  return team as Team;
}

export async function getTeamsByUser(uid: string): Promise<Team[]> {
  const db = await getMongoDb();
  const teams = await db.collection('teams').find({ coachUid: uid }).toArray();
  return teams as Team[];
}

export async function getAllTeams(): Promise<Team[]> {
  const db = await getMongoDb();
  const teams = await db.collection('teams').find({}).toArray();
  return teams as Team[];
}

export async function getSessionsByTeam(teamId: string): Promise<Session[]> {
  const db = await getMongoDb();
  const sessions = await db.collection('sessions').find({ teamId }).toArray();
  return sessions as Session[];
}


