/**
 * Server-only database adapter
 * This file should NEVER be imported in client components
 * 
 * IMPORTANT: This file uses dynamic require() to prevent MongoDB
 * from being bundled in client code. All MongoDB imports happen
 * only at runtime on the server side.
 */

// Only import config - this is safe for client/server
import { config } from '@/lib/utils/config';
import type { DatabaseAdapter } from './adapter';

let adapter: DatabaseAdapter | null = null;

export function getDatabaseAdapter(): DatabaseAdapter {
  // Only allow on server side
  if (typeof window !== 'undefined') {
    throw new Error('Database adapter cannot be used in client components. Use API routes instead.');
  }

  if (!adapter) {
    if (config.databaseType === 'mongodb') {
      // CRITICAL: Use require() instead of import to prevent bundling
      // This ensures MongoDB is never included in client bundle
      const mongodbAdapterModule = require('./mongodb-adapter');
      const MongodbAdapter = mongodbAdapterModule.MongodbAdapter;
      adapter = new MongodbAdapter();
    } else {
      // Dynamic require for Firestore too to be safe
      const firestoreAdapterModule = require('./firestore-adapter');
      const FirestoreAdapter = firestoreAdapterModule.FirestoreAdapter;
      adapter = new FirestoreAdapter();
    }
  }
  return adapter;
}

