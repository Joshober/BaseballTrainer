import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirestoreDb } from './config';
import { trackFirestoreRead, trackFirestoreWrite } from './billing-protection';
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry, Team } from '@/types/team';
import type { Message, CreateMessageInput, Conversation } from '@/types/message';

// Users
export async function getUser(uid: string): Promise<User | null> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return {
    uid: userDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as User;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreWrite();
  const userRef = doc(db, 'users', input.uid);
  await setDoc(userRef, {
    displayName: input.displayName,
    email: input.email,
    teamId: input.teamId || null,
    createdAt: serverTimestamp(),
  });
  return getUser(input.uid) as Promise<User>;
}

// Sessions
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreWrite();
  const sessionRef = await addDoc(collection(db, 'sessions'), {
    uid: input.uid,
    teamId: input.teamId,
    photoPath: input.photoPath,
    photoURL: input.photoURL || null,
    videoPath: input.videoPath || null,
    videoURL: input.videoURL || null,
    metrics: input.metrics,
    game: input.game,
    label: input.label,
    createdAt: serverTimestamp(),
  });
  trackFirestoreRead();
  const sessionDoc = await getDoc(sessionRef);
  const data = sessionDoc.data();
  return {
    id: sessionDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
  } as Session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
  if (!sessionDoc.exists()) return null;
  const data = sessionDoc.data();
  return {
    id: sessionDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
  } as Session;
}

export async function getSessionsByUser(uid: string): Promise<Session[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const q = query(collection(db, 'sessions'), where('uid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
    } as Session;
  });
}

// Leaderboard
export async function updateLeaderboard(
  teamId: string,
  uid: string,
  distanceFt: number,
  sessionId: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const entryRef = doc(db, 'leaderboards', teamId, 'entries', uid);
  const entryDoc = await getDoc(entryRef);
  const best = entryDoc.exists() ? (entryDoc.data().bestDistanceFt || 0) : 0;
  if (distanceFt > best) {
    trackFirestoreWrite();
    await setDoc(
      entryRef,
      {
        bestDistanceFt: distanceFt,
        bestSessionId: sessionId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function getLeaderboardEntries(teamId: string): Promise<LeaderboardEntry[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const entriesRef = collection(db, 'leaderboards', teamId, 'entries');
  const snapshot = await getDocs(entriesRef);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      teamId,
      ...data,
      updatedAt: data?.updatedAt?.toDate() || new Date(),
    } as LeaderboardEntry;
  });
}

// Teams
export async function createTeam(name: string, coachUid: string): Promise<Team> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreWrite();
  const teamRef = await addDoc(collection(db, 'teams'), {
    name,
    coachUid,
    createdAt: serverTimestamp(),
  });
  trackFirestoreRead();
  const teamDoc = await getDoc(teamRef);
  const data = teamDoc.data();
  return {
    id: teamDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
  } as Team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const teamDoc = await getDoc(doc(db, 'teams', teamId));
  if (!teamDoc.exists()) return null;
  const data = teamDoc.data();
  return {
    id: teamDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
  } as Team;
}

export async function getTeamsByUser(uid: string): Promise<Team[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const q = query(collection(db, 'teams'), where('coachUid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
    } as Team;
  });
}

export async function getAllTeams(): Promise<Team[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const snapshot = await getDocs(collection(db, 'teams'));
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
    } as Team;
  });
}

export async function getSessionsByTeam(teamId: string): Promise<Session[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const q = query(collection(db, 'sessions'), where('teamId', '==', teamId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
    } as Session;
  });
}

// Messages
function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export async function createMessage(senderUid: string, input: CreateMessageInput): Promise<Message> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  const conversationId = getConversationId(senderUid, input.receiverUid);
  
  trackFirestoreWrite();
  const messageRef = await addDoc(collection(db, 'messages'), {
    conversationId,
    senderUid,
    receiverUid: input.receiverUid,
    content: input.content,
    videoURL: input.videoURL || null,
    videoPath: input.videoPath || null,
    sessionId: input.sessionId || null,
    createdAt: serverTimestamp(),
    readAt: null,
  });
  
  trackFirestoreRead();
  const messageDoc = await getDoc(messageRef);
  const messageData = messageDoc.data();
  const message = {
    id: messageDoc.id,
    ...messageData,
    createdAt: messageData?.createdAt?.toDate() || new Date(),
  } as Message;
  
  // Update or create conversation
  const conversationRef = doc(db, 'conversations', conversationId);
  trackFirestoreRead();
  const conversationDoc = await getDoc(conversationRef);
  
  trackFirestoreWrite();
  await setDoc(
    conversationRef,
    {
      participant1Uid: [senderUid, input.receiverUid].sort()[0],
      participant2Uid: [senderUid, input.receiverUid].sort()[1],
      lastMessage: message,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  
  return message;
}

export async function getMessages(uid1: string, uid2: string): Promise<Message[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  const conversationId = getConversationId(uid1, uid2);
  
  trackFirestoreRead();
  const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate() || new Date(),
        readAt: data?.readAt?.toDate() || undefined,
      } as Message;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getConversations(uid: string): Promise<Conversation[]> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  trackFirestoreRead();
  const q1 = query(collection(db, 'conversations'), where('participant1Uid', '==', uid));
  const q2 = query(collection(db, 'conversations'), where('participant2Uid', '==', uid));
  const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  const conversations = new Map<string, Conversation>();
  
  [...snapshot1.docs, ...snapshot2.docs].forEach((doc) => {
    const data = doc.data();
    const conv = {
      id: doc.id,
      ...data,
      updatedAt: data?.updatedAt?.toDate() || new Date(),
      lastMessage: data?.lastMessage
        ? {
            ...data.lastMessage,
            createdAt: data.lastMessage.createdAt?.toDate() || new Date(),
            readAt: data.lastMessage.readAt?.toDate() || undefined,
          }
        : undefined,
    } as Conversation;
    conversations.set(doc.id, conv);
  });
  
  // Calculate unread count for each conversation
  const conversationsWithUnread = await Promise.all(
    Array.from(conversations.values()).map(async (conv) => {
      const otherUid = conv.participant1Uid === uid ? conv.participant2Uid : conv.participant1Uid;
      trackFirestoreRead();
      const unreadQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conv.id),
        where('receiverUid', '==', uid),
        where('readAt', '==', null)
      );
      const unreadSnapshot = await getDocs(unreadQuery);
      return {
        ...conv,
        unreadCount: unreadSnapshot.size,
      } as Conversation;
    })
  );
  
  return conversationsWithUnread.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function markMessagesAsRead(uid1: string, uid2: string, readerUid: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore is disabled due to billing protection or missing configuration.');
  }
  
  const conversationId = getConversationId(uid1, uid2);
  
  trackFirestoreRead();
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    where('receiverUid', '==', readerUid),
    where('readAt', '==', null)
  );
  const snapshot = await getDocs(q);
  
  const batch = snapshot.docs.map((doc) => {
    trackFirestoreWrite();
    return updateDoc(doc.ref, {
      readAt: serverTimestamp(),
    });
  });
  
  await Promise.all(batch);
}


