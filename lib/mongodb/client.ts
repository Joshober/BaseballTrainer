import { MongoClient, Db } from 'mongodb';
import { config } from '@/lib/utils/config';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * URL-encode password in MongoDB connection string
 */
function encodePasswordInUri(uri: string): string {
  // Match: mongodb+srv://username:password@host
  const uriPattern = /^(mongodb\+srv?:\/\/)([^:]+):([^@]+)@(.+)$/;
  const match = uri.match(uriPattern);
  
  if (match) {
    const [, protocol, username, password, rest] = match;
    // URL-encode the password
    const encodedPassword = encodeURIComponent(password);
    return `${protocol}${username}:${encodedPassword}@${rest}`;
  }
  
  // If pattern doesn't match, return as-is (might already be encoded or different format)
  return uri;
}

export async function getMongoClient(): Promise<MongoClient> {
  // Check if client exists and is connected
  let isConnected = false;
  try {
    if (client) {
      // Try to ping the server to check connection
      await client.db().admin().ping();
      isConnected = true;
    }
  } catch {
    // Client is not connected, reset it
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore errors when closing
      }
      client = null;
    }
  }

  if (!client || !isConnected) {
    if (!config.mongodb.uri) {
      throw new Error('MONGODB_URI is not configured');
    }
    
    // Parse and validate the connection string
    let uri = config.mongodb.uri;
    
    // Auto-encode password if needed
    uri = encodePasswordInUri(uri);
    
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 5000,
      });
      await client.connect();
    } catch (error: any) {
      // Reset client on error
      client = null;
      if (error.message?.includes('unescaped characters') || error.message?.includes('MongoParseError')) {
        throw new Error(
          'MongoDB connection string has unescaped characters. ' +
          'The password has been auto-encoded, but if the error persists, ' +
          'please check your connection string format. ' +
          'Run: npm run encode:password "YourPassword" to manually encode it.'
        );
      }
      throw error;
    }
  }
  return client;
}

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    const client = await getMongoClient();
    
    // Extract database name from URI or use default
    let dbName = 'baseballhackathon';
    const uri = config.mongodb.uri;
    
    // Try to extract database name from URI
    // Format: mongodb+srv://user:pass@host/dbname?options
    const dbMatch = uri.match(/mongodb\+srv?:\/\/[^/]+\/([^?]+)/);
    if (dbMatch && dbMatch[1] && dbMatch[1] !== '') {
      dbName = dbMatch[1];
    }
    
    db = client.db(dbName);
    
    // Create indexes (with error handling)
    try {
      await db.collection('users').createIndex({ uid: 1 }, { unique: true });
      await db.collection('sessions').createIndex({ uid: 1 });
      await db.collection('sessions').createIndex({ teamId: 1 });
      await db.collection('leaderboardEntries').createIndex({ teamId: 1, uid: 1 }, { unique: true });
    } catch (error) {
      // Indexes might already exist, that's okay
      console.warn('Index creation warning (may already exist):', error);
    }
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


