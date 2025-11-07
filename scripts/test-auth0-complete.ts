/**
 * Complete Auth0 Test
 * Tests all Auth0 endpoints and functionality
 */
import * as axios from 'axios';

const BACKEND_URL = process.env.AUTH0_BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

console.log('\n' + '='.repeat(60));
console.log('  Complete Auth0 Test');
console.log('='.repeat(60) + '\n');

let allTestsPassed = true;

async function testEndpoint(name: string, url: string, expectedStatus: number = 200) {
  try {
    const response = await axios.default.get(url, {
      validateStatus: () => true, // Don't throw on any status
      maxRedirects: 0,
    });
    
    if (response.status === expectedStatus || (expectedStatus === 302 && response.status === 302)) {
      console.log(`✅ ${name}: PASSED (Status: ${response.status})`);
      if (response.status === 302 && response.headers.location) {
        console.log(`   Redirects to: ${response.headers.location.substring(0, 80)}...`);
      }
      return true;
    } else {
      console.log(`❌ ${name}: FAILED (Expected: ${expectedStatus}, Got: ${response.status})`);
      if (response.data) {
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}`);
      }
      return false;
    }
  } catch (error: any) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Backend Gateway Endpoints:\n');
  
  // Test health endpoint
  const healthPassed = await testEndpoint(
    'Health Check',
    `${BACKEND_URL}/health`,
    200
  );
  allTestsPassed = allTestsPassed && healthPassed;
  
  // Test Auth0 login endpoint (should redirect)
  const loginPassed = await testEndpoint(
    'Auth0 Login',
    `${BACKEND_URL}/api/auth/login`,
    302
  );
  allTestsPassed = allTestsPassed && loginPassed;
  
  // Test Auth0 logout endpoint (should redirect)
  const logoutPassed = await testEndpoint(
    'Auth0 Logout',
    `${BACKEND_URL}/api/auth/logout`,
    302
  );
  allTestsPassed = allTestsPassed && logoutPassed;
  
  // Test Auth0 user endpoint (should require auth)
  const userPassed = await testEndpoint(
    'Auth0 User (Unauthenticated)',
    `${BACKEND_URL}/api/auth/user`,
    401
  );
  allTestsPassed = allTestsPassed && userPassed;
  
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('✅ All tests passed!');
    console.log('\nNext steps:');
    console.log('  1. Start frontend: npm run dev');
    console.log('  2. Test login flow at: http://localhost:3000/login');
    console.log('  3. Make sure Auth0 Dashboard has these URLs configured:');
    console.log(`     - Callback URL: ${BACKEND_URL}/api/auth/callback`);
    console.log(`     - Logout URL: ${FRONTEND_URL}`);
    console.log(`     - Web Origins: ${FRONTEND_URL}`);
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
  }
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);

