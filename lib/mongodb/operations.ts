import { getMongoDb } from './client';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';
import type { Message, CreateMessageInput, Conversation } from '@/types/message';

// Users
export async function getUser(uid: string): Promise<User | null> {
  const db = await getMongoDb();
  const user = await db.collection('users').findOne({ uid });
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    role: user.role || 'player',
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
    role: input.role,
    teamId: input.teamId || null,
    createdAt: new Date(),
  };
  await db.collection('users').insertOne(user);
  return getUser(input.uid) as Promise<User>;
}

export async function getUsersByTeam(teamId: string): Promise<User[]> {
  const db = await getMongoDb();
  const users = await db.collection('users').find({ teamId, role: 'player' }).toArray();
  return users.map((user) => ({
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    teamId: user.teamId || undefined,
    createdAt: user.createdAt || new Date(),
  })) as User[];
}

export async function updateUser(uid: string, updates: Partial<CreateUserInput>): Promise<User> {
  const db = await getMongoDb();
  const updateData: any = {
    updatedAt: new Date(),
  };
  
  if (updates.displayName !== undefined) {
    updateData.displayName = updates.displayName;
  }
  if (updates.email !== undefined) {
    updateData.email = updates.email;
  }
  if (updates.role !== undefined) {
    updateData.role = updates.role;
  }
  if (updates.teamId !== undefined) {
    updateData.teamId = updates.teamId || null;
  }
  
  await db.collection('users').updateOne(
    { uid },
    { $set: updateData }
  );
  
  return getUser(uid) as Promise<User>;
}

// Sessions
export async function createSession(input: CreateSessionInput): Promise<Session> {
  try {
    const db = await getMongoDb();
    const session = {
      id: crypto.randomUUID(),
      uid: input.uid,
      teamId: input.teamId,
      photoPath: input.photoPath || '',
      photoURL: input.photoURL || null,
      videoPath: input.videoPath || null,
      videoURL: input.videoURL || null,
      metrics: input.metrics,
      game: input.game,
      label: input.label,
      videoAnalysis: input.videoAnalysis || null,
      createdAt: new Date(),
    };
    await db.collection('sessions').insertOne(session);
    return session as Session;
  } catch (error: any) {
    console.error('MongoDB createSession error:', error);
    throw new Error(`Failed to create session in database: ${error.message || 'Unknown error'}`);
  }
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

// Messages
function getConversationId(uid1: string, uid2: string): string {
  // Always create consistent conversation ID regardless of order
  return [uid1, uid2].sort().join('_');
}

export async function createMessage(senderUid: string, input: CreateMessageInput): Promise<Message> {
  const db = await getMongoDb();
  const conversationId = getConversationId(senderUid, input.receiverUid);
  
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    senderUid,
    receiverUid: input.receiverUid,
    content: input.content,
    videoURL: input.videoURL || null,
    videoPath: input.videoPath || null,
    sessionId: input.sessionId || null,
    createdAt: new Date(),
    readAt: null,
  };
  
  await db.collection('messages').insertOne(message);
  
  // Update or create conversation
  await db.collection('conversations').updateOne(
    { id: conversationId },
    {
      $set: {
        id: conversationId,
        participant1Uid: [senderUid, input.receiverUid].sort()[0],
        participant2Uid: [senderUid, input.receiverUid].sort()[1],
        lastMessage: message,
        updatedAt: new Date(),
      },
      $inc: {
        unreadCount: 1,
      },
    },
    { upsert: true }
  );
  
  // Reset unread count for sender's side
  await db.collection('conversations').updateOne(
    { id: conversationId },
    {
      $set: {
        [`unreadCount_${senderUid}`]: 0,
      },
    }
  );
  
  return message as Message;
}

export async function getMessages(uid1: string, uid2: string): Promise<Message[]> {
  const db = await getMongoDb();
  const conversationId = getConversationId(uid1, uid2);
  
  const messages = await db.collection('messages')
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .toArray();
  
  return messages as Message[];
}

export async function getConversations(uid: string): Promise<Conversation[]> {
  const db = await getMongoDb();
  
  const conversations = await db.collection('conversations')
    .find({
      $or: [
        { participant1Uid: uid },
        { participant2Uid: uid },
      ],
    })
    .sort({ updatedAt: -1 })
    .toArray();
  
  // Calculate unread count for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conv) => {
      const otherUid = conv.participant1Uid === uid ? conv.participant2Uid : conv.participant1Uid;
      const unreadCount = await db.collection('messages').countDocuments({
        conversationId: conv.id,
        receiverUid: uid,
        readAt: null,
      });
      
      return {
        ...conv,
        unreadCount,
      } as Conversation;
    })
  );
  
  return conversationsWithUnread;
}

export async function markMessagesAsRead(uid1: string, uid2: string, readerUid: string): Promise<void> {
  const db = await getMongoDb();
  const conversationId = getConversationId(uid1, uid2);
  
  await db.collection('messages').updateMany(
    {
      conversationId,
      receiverUid: readerUid,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    }
  );
  
  // Reset unread count in conversation
  await db.collection('conversations').updateOne(
    { id: conversationId },
    {
      $set: {
        [`unreadCount_${readerUid}`]: 0,
      },
    }
  );
}

// Video Analysis
export async function saveVideoAnalysis(
  userId: string,
  videoAnalysis: any,
  videoFileName?: string,
  videoUrl?: string,
  sessionId?: string
): Promise<string> {
  const db = await getMongoDb();

  // Remove null/undefined values before saving
  const cleanedAnalysis = removeNullValues(videoAnalysis);

  const now = new Date();
  const filter: any = sessionId ? { sessionId } : (videoUrl ? { videoUrl } : { id: '__none__' });
  const existing = await db.collection('videoAnalyses').findOne(filter);

  if (existing) {
    await db.collection('videoAnalyses').updateOne(
      { id: existing.id },
      {
        $set: {
          userId,
          videoFileName: videoFileName || existing.videoFileName || null,
          videoUrl: videoUrl || existing.videoUrl || null,
          sessionId: sessionId || existing.sessionId || null,
          analysis: cleanedAnalysis,
          status: 'completed',
          updatedAt: now,
          completedAt: now,
          error: null,
        },
        $inc: { attempts: 1 },
      }
    );
    return existing.id as string;
  }

  const analysisRecord: any = {
    id: crypto.randomUUID(),
    userId,
    videoFileName: videoFileName || null,
    videoUrl: videoUrl || null,
    sessionId: sessionId || null,
    analysis: cleanedAnalysis,
    status: 'completed',
    attempts: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    lastAttemptAt: now,
    error: null,
  };

  await db.collection('videoAnalyses').insertOne(analysisRecord);

  // Create indexes if they don't exist
  try {
    await db.collection('videoAnalyses').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('videoAnalyses').createIndex({ sessionId: 1, createdAt: -1 });
    await db.collection('videoAnalyses').createIndex({ videoUrl: 1, createdAt: -1 });
    await db.collection('videoAnalyses').createIndex({ status: 1, lastAttemptAt: -1 });
  } catch (error) {
    // Index might already exist
  }

  return analysisRecord.id as string;
}

export async function getVideoAnalysesByUser(userId: string, limit: number = 50): Promise<any[]> {
  const db = await getMongoDb();
  const analyses = await db.collection('videoAnalyses')
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  
  return analyses.map(analysis => ({
    id: analysis.id,
    userId: analysis.userId,
    videoFileName: analysis.videoFileName,
    videoUrl: analysis.videoUrl,
    sessionId: analysis.sessionId,
    status: analysis.status,
    analysis: removeNullValues(analysis.analysis), // Clean on retrieval too
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  }));
}

export async function getVideoAnalysis(analysisId: string): Promise<any | null> {
  const db = await getMongoDb();
  const analysis = await db.collection('videoAnalyses').findOne({ id: analysisId });
  if (!analysis) return null;
  
  return {
    id: analysis.id,
    userId: analysis.userId,
    videoFileName: analysis.videoFileName,
    videoUrl: analysis.videoUrl,
    sessionId: analysis.sessionId,
    status: analysis.status,
    analysis: removeNullValues(analysis.analysis),
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

export async function getVideoAnalysisBySessionId(sessionId: string): Promise<any | null> {
  const db = await getMongoDb();
  const analysis = await db.collection('videoAnalyses')
    .find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (!analysis) return null;
  return {
    id: analysis.id,
    userId: analysis.userId,
    videoFileName: analysis.videoFileName,
    videoUrl: analysis.videoUrl,
    sessionId: analysis.sessionId,
    status: analysis.status,
    analysis: removeNullValues(analysis.analysis),
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

export async function getVideoAnalysisByVideoUrl(videoUrl: string): Promise<any | null> {
  const db = await getMongoDb();
  const analysis = await db.collection('videoAnalyses')
    .find({ videoUrl })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (!analysis) return null;
  return {
    id: analysis.id,
    userId: analysis.userId,
    videoFileName: analysis.videoFileName,
    videoUrl: analysis.videoUrl,
    sessionId: analysis.sessionId,
    analysis: removeNullValues(analysis.analysis),
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

export async function updateSessionVideoAnalysis(sessionId: string, analysis: any): Promise<void> {
  const db = await getMongoDb();
  await db.collection('sessions').updateOne(
    { id: sessionId },
    {
      $set: {
        videoAnalysis: removeNullValues(analysis),
        updatedAt: new Date(),
      },
    }
  );
}

export async function updateSessionRecommendations(sessionId: string, recommendations: any): Promise<void> {
  const db = await getMongoDb();
  await db.collection('sessions').updateOne(
    { id: sessionId },
    {
      $set: {
        recommendations: recommendations || null,
        updatedAt: new Date(),
      },
    }
  );
}

export async function getSessionsMissingRecommendations(limit: number = 50): Promise<Session[]> {
  const db = await getMongoDb();
  const sessions = await db.collection('sessions')
    .find({
      videoURL: { $ne: null },
      $or: [
        { recommendations: { $exists: false } },
        { recommendations: null },
      ],
    })
    .limit(limit)
    .toArray();
  return sessions as Session[];
}

export async function getVideoAnalysisBySessionIds(sessionIds: string[]): Promise<Record<string, any | null>> {
  const db = await getMongoDb();
  const records = await db.collection('videoAnalyses')
    .find({ sessionId: { $in: sessionIds } })
    .sort({ createdAt: -1 })
    .toArray();
  const map: Record<string, any | null> = {};
  for (const id of sessionIds) {
    map[id] = null;
  }
  for (const rec of records) {
    if (rec.sessionId && map[rec.sessionId] === null) {
      map[rec.sessionId] = {
        id: rec.id,
        userId: rec.userId,
        videoFileName: rec.videoFileName,
        videoUrl: rec.videoUrl,
        sessionId: rec.sessionId,
        status: rec.status,
        analysis: removeNullValues(rec.analysis),
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        lastAttemptAt: rec.lastAttemptAt,
      };
    }
  }
  return map;
}

export async function upsertVideoAnalysisPending(
  userId: string,
  sessionId?: string,
  videoUrl?: string
): Promise<void> {
  const db = await getMongoDb();
  const now = new Date();
  const filter: any = sessionId ? { sessionId } : (videoUrl ? { videoUrl } : { id: '__none__' });
  const existing = await db.collection('videoAnalyses').findOne(filter);
  if (existing) {
    await db.collection('videoAnalyses').updateOne(
      { id: existing.id },
      {
        $set: {
          userId,
          status: 'in_progress',
          updatedAt: now,
          lastAttemptAt: now,
          error: null,
        },
        $inc: { attempts: 1 },
      }
    );
    return;
  }
  await db.collection('videoAnalyses').insertOne({
    id: crypto.randomUUID(),
    userId,
    sessionId: sessionId || null,
    videoUrl: videoUrl || null,
    status: 'in_progress',
    attempts: 1,
    analysis: null,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: now,
    error: null,
  });
}

export async function markVideoAnalysisFailed(
  sessionId: string | undefined,
  videoUrl: string | undefined,
  error: string
): Promise<void> {
  const db = await getMongoDb();
  const filter: any = sessionId ? { sessionId } : (videoUrl ? { videoUrl } : { id: '__none__' });
  const now = new Date();
  await db.collection('videoAnalyses').updateOne(
    filter,
    {
      $set: {
        status: 'failed',
        error,
        updatedAt: now,
        lastAttemptAt: now,
      },
    }
  );
}


/**
 * Recursively remove null and undefined values from an object
 */
function removeNullValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined; // Will be filtered out
  }
  
  if (Array.isArray(obj)) {
    const filtered = obj.map(item => removeNullValues(item)).filter(item => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = removeNullValues(value);
      if (cleanedValue !== undefined && cleanedValue !== null) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  
  return obj;
}


