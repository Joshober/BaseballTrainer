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
import type { User, CreateUserInput } from '@/types/user';
import type { Session, CreateSessionInput } from '@/types/session';
import type { LeaderboardEntry } from '@/types/team';

const db = getFirestoreDb();

// Users
export async function getUser(uid: string): Promise<User | null> {
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
  const sessionDoc = await getDoc(sessionRef);
  const data = sessionDoc.data();
  return {
    id: sessionDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
  } as Session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
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
  const entryRef = doc(db, 'leaderboards', teamId, 'entries', uid);
  const entryDoc = await getDoc(entryRef);
  const best = entryDoc.exists() ? (entryDoc.data().bestDistanceFt || 0) : 0;
  if (distanceFt > best) {
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


