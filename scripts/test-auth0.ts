/**
 * Test Auth0 Configuration
 * Verifies that Auth0 is properly configured
 */
import { config } from '../lib/utils/config';
import { isAuth0Configured } from '../lib/auth0/config';

console.log('\n' + '='.repeat(60));
console.log('  Auth0 Configuration Test');
console.log('='.repeat(60) + '\n');

// Check if Auth0 is configured
const auth0Config = config.auth0;
const configured = isAuth0Configured();

console.log('Auth0 Configuration Status:');
console.log('  Domain:', auth0Config.domain || '❌ NOT SET');
console.log('  Client ID:', auth0Config.clientId ? '✅ SET' : '❌ NOT SET');
console.log('  Client Secret:', auth0Config.clientSecret ? '✅ SET' : '❌ NOT SET');
console.log('  Base URL:', auth0Config.baseURL || '❌ NOT SET');
console.log('  Scope:', auth0Config.scope);
console.log('');

if (!configured) {
  console.log('❌ Auth0 is NOT properly configured!');
  console.log('\nMissing required environment variables:');
  if (!auth0Config.domain) console.log('  - AUTH0_DOMAIN');
  if (!auth0Config.clientId) console.log('  - AUTH0_CLIENT_ID');
  if (!auth0Config.clientSecret) console.log('  - AUTH0_CLIENT_SECRET');
  if (!auth0Config.baseURL) console.log('  - AUTH0_BASE_URL');
  console.log('\nPlease add these to .env.local in the root directory.');
  console.log('See docs/AUTH0_SETUP.md for setup instructions.');
  process.exit(1);
}

console.log('✅ Auth0 is properly configured!');
console.log('\nNext steps:');
console.log('  1. Make sure Auth0 Dashboard is configured:');
console.log('     - Callback URL: http://localhost:3001/api/auth/callback');
console.log('     - Logout URL: http://localhost:3000');
console.log('     - Web Origins: http://localhost:3000');
console.log('  2. Start backend gateway: npm run dev:gateway');
console.log('  3. Start frontend: npm run dev');
console.log('  4. Test login at: http://localhost:3000/login');
console.log('');

// Check backend gateway URL
const gatewayUrl = config.gateway.url;
console.log('Backend Gateway Configuration:');
console.log('  URL:', gatewayUrl);
console.log('  Port:', config.gateway.port);
console.log('');

// Check frontend URL
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
console.log('Frontend Configuration:');
console.log('  URL:', frontendUrl);
console.log('');

console.log('='.repeat(60));
console.log('  Test Complete');
console.log('='.repeat(60) + '\n');

