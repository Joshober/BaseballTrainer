import { MongoClient, Db } from 'mongodb';
import { config } from '@/lib/utils/config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    if (!config.mongodb.uri) {
      throw new Error('MONGODB_URI is not configured');
    }
    client = new MongoClient(config.mongodb.uri);
    await client.connect();
  }
  return client;
}

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    const client = await getMongoClient();
    const dbName = config.mongodb.uri.split('/').pop()?.split('?')[0] || 'baseballhackathon';
    db = client.db(dbName);
    
    // Create indexes
    await db.collection('users').createIndex({ uid: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ uid: 1 });
    await db.collection('sessions').createIndex({ teamId: 1 });
    await db.collection('leaderboardEntries').createIndex({ teamId: 1, uid: 1 }, { unique: true });
  }
  return db;
}

export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

