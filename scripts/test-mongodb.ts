#!/usr/bin/env tsx
/**
 * Test MongoDB connection
 * 
 * This script tests if MongoDB is configured correctly and can connect.
 */

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

import { getMongoClient, getMongoDb } from '../lib/mongodb/client';
import { config as appConfig } from '../lib/utils/config';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testMongoConnection() {
  log('\n' + '='.repeat(60), 'bright');
  log('  MongoDB Connection Test', 'bright');
  log('  Baseball Swing Analysis App', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  // Check if MongoDB URI is configured
  const mongoUri = process.env.MONGODB_URI || appConfig.mongodb.uri;
  
  if (!mongoUri || mongoUri === '') {
    log('❌ MongoDB URI not configured', 'red');
    log('\nPlease add MONGODB_URI to your .env.local file:', 'yellow');
    log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority', 'cyan');
    log('\nOr set DATABASE_TYPE=firestore to use Firestore instead.', 'yellow');
    process.exit(1);
  }

  // Remove quotes if present
  const cleanUri = mongoUri.replace(/^["']|["']$/g, '');

  // Check if URI looks valid
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    log('⚠️  MongoDB URI format looks incorrect', 'yellow');
    log(`URI should start with "mongodb://" or "mongodb+srv://"`, 'yellow');
    log(`Current URI: ${cleanUri.substring(0, 20)}...`, 'yellow');
  }

  log('Testing MongoDB connection...', 'blue');
  log(`URI: ${cleanUri.replace(/:[^:@]+@/, ':****@')}`, 'cyan');
  
  // Temporarily override config for testing
  process.env.MONGODB_URI = cleanUri;
  
  // Force reload config by clearing module cache
  delete require.cache[require.resolve('../lib/utils/config')];
  delete require.cache[require.resolve('../lib/mongodb/client')];
  
  // Re-import after clearing cache
  const { getMongoClient: getClient, getMongoDb: getDb } = require('../lib/mongodb/client');

  try {
    log('\n[1/3] Connecting to MongoDB...', 'yellow');
    const client = await getClient();
    log('  ✓ Client created successfully', 'green');

    log('\n[2/3] Testing database connection...', 'yellow');
    const db = await getDb();
    log('  ✓ Database connection successful', 'green');

    log('\n[3/3] Testing ping...', 'yellow');
    const result = await db.admin().ping();
    log('  ✓ Ping successful', 'green');
    log(`  Response: ${JSON.stringify(result)}`, 'cyan');

    log('\n' + '='.repeat(60), 'bright');
    log('  Connection Test Results', 'bright');
    log('='.repeat(60), 'bright');
    log('\n✅ MongoDB connection successful!', 'green');
    log('  Your MongoDB is configured correctly.', 'green');
    log('  You can now use MongoDB as your database.\n', 'green');

    // Test a simple operation
    log('Testing database operations...', 'blue');
    const testCollection = db.collection('test');
    const testDoc = { test: true, timestamp: new Date() };
    
    log('  Inserting test document...', 'yellow');
    await testCollection.insertOne(testDoc);
    log('  ✓ Insert successful', 'green');

    log('  Reading test document...', 'yellow');
    const found = await testCollection.findOne({ test: true });
    if (found) {
      log('  ✓ Read successful', 'green');
    }

    log('  Deleting test document...', 'yellow');
    await testCollection.deleteOne({ test: true });
    log('  ✓ Delete successful', 'green');

    log('\n✅ All database operations working correctly!\n', 'green');

    // Close connection
    await client.close();
    log('Connection closed.', 'cyan');

    process.exit(0);
  } catch (error: any) {
    log('\n' + '='.repeat(60), 'bright');
    log('  Connection Test Failed', 'bright');
    log('='.repeat(60), 'bright');
    log('\n❌ MongoDB connection failed:', 'red');
    log(`  Error: ${error.message}`, 'red');
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      log('\n💡 Authentication Error:', 'yellow');
      log('  - Check your username and password in the connection string', 'yellow');
      log('  - Make sure the database user has proper permissions', 'yellow');
      log('  - If password has special characters, URL-encode them:', 'yellow');
      log('    Example: @ = %40, # = %23, $ = %24, etc.', 'cyan');
      log('  - Verify the user exists in MongoDB Atlas', 'yellow');
      log('  - Check that the user has "Read and write" permissions', 'yellow');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      log('\n💡 Network Error:', 'yellow');
      log('  - Check your cluster URL in the connection string', 'yellow');
      log('  - Make sure your IP address is whitelisted in MongoDB Atlas', 'yellow');
      log('  - Check your internet connection', 'yellow');
    } else if (error.message.includes('timeout')) {
      log('\n💡 Timeout Error:', 'yellow');
      log('  - Check your IP address is whitelisted in MongoDB Atlas', 'yellow');
      log('  - Try using 0.0.0.0/0 for development (less secure)', 'yellow');
    } else {
      log('\n💡 Troubleshooting:', 'yellow');
      log('  - Verify your MONGODB_URI in .env.local', 'yellow');
      log('  - Check MongoDB Atlas connection string format', 'yellow');
      log('  - Ensure your IP is whitelisted in MongoDB Atlas', 'yellow');
      log('  - Verify database user credentials', 'yellow');
    }

    log('\nFull error:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testMongoConnection().catch((error) => {
  log(`\n✗ Fatal error: ${error}`, 'red');
  process.exit(1);
});

