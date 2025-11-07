import { config } from '@/lib/utils/config';
import { FirestoreAdapter } from './firestore-adapter';
import { MongodbAdapter } from './mongodb-adapter';
import type { DatabaseAdapter } from './adapter';

let adapter: DatabaseAdapter | null = null;

export function getDatabaseAdapter(): DatabaseAdapter {
  if (!adapter) {
    if (config.databaseType === 'mongodb') {
      adapter = new MongodbAdapter();
    } else {
      adapter = new FirestoreAdapter();
    }
  }
  return adapter;
}

export const db = getDatabaseAdapter();

