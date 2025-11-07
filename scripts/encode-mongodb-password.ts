#!/usr/bin/env tsx
/**
 * URL-encode MongoDB password
 * 
 * This script helps you encode special characters in your MongoDB password
 * for use in the connection string.
 */

const password = process.argv[2];

if (!password) {
  console.log('Usage: npm run encode:password "YourPassword"');
  console.log('\nExample:');
  console.log('  npm run encode:password "My@Pass#123"');
  console.log('  Output: My%40Pass%23123');
  process.exit(1);
}

// URL-encode the password
const encoded = encodeURIComponent(password);

console.log('\n' + '='.repeat(60));
console.log('  MongoDB Password Encoder');
console.log('='.repeat(60) + '\n');
console.log('Original password:', password);
console.log('URL-encoded password:', encoded);
console.log('\nUse this in your connection string:');
console.log(`mongodb+srv://username:${encoded}@cluster.mongodb.net/database?retryWrites=true&w=majority`);
console.log('\n' + '='.repeat(60) + '\n');

