/**
 * Test Authentication Methods
 * Tests both Google OAuth and Email/Password authentication
 */
import * as axios from 'axios';

const BACKEND_URL = process.env.AUTH0_BASE_URL || 'http://localhost:3001';

console.log('\n' + '='.repeat(60));
console.log('  Authentication Methods Test');
console.log('='.repeat(60) + '\n');

async function testEndpoint(name: string, method: string, url: string, data?: any) {
  try {
    const config: any = {
      method,
      url,
      validateStatus: () => true, // Don't throw on any status
      maxRedirects: 0,
    };
    
    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }
    
    const response = await axios.default(config);
    
    if (response.status === 200 || response.status === 302) {
      console.log(`✅ ${name}: PASSED (Status: ${response.status})`);
      if (response.status === 302 && response.headers.location) {
        console.log(`   Redirects to: ${response.headers.location.substring(0, 80)}...`);
      }
      if (response.data && typeof response.data === 'object' && !response.data.error) {
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      }
      return true;
    } else {
      console.log(`❌ ${name}: FAILED (Status: ${response.status})`);
      if (response.data) {
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}`);
      }
      return false;
    }
  } catch (error: any) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Authentication Endpoints:\n');
  
  // Test Google OAuth login (should redirect)
  const googleLoginPassed = await testEndpoint(
    'Google OAuth Login',
    'GET',
    `${BACKEND_URL}/api/auth/login?connection=google-oauth2`,
  );
  
  // Test Email/Password registration endpoint (should accept POST)
  const emailRegisterPassed = await testEndpoint(
    'Email/Password Registration Endpoint',
    'POST',
    `${BACKEND_URL}/api/auth/register`,
    { email: 'test@example.com', password: 'testpassword123' },
  );
  
  // Test Email/Password login endpoint (should accept POST)
  const emailLoginPassed = await testEndpoint(
    'Email/Password Login Endpoint',
    'POST',
    `${BACKEND_URL}/api/auth/login-email`,
    { email: 'test@example.com', password: 'testpassword123' },
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary:');
  console.log('='.repeat(60));
  console.log(`Google OAuth Login: ${googleLoginPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Email/Password Registration: ${emailRegisterPassed ? '✅ PASSED' : '❌ FAILED (expected - test user may already exist)'}`);
  console.log(`Email/Password Login: ${emailLoginPassed ? '✅ PASSED' : '❌ FAILED (expected - test user may not exist)'}`);
  console.log('\nNote:');
  console.log('- Google OAuth redirects to Auth0 (this is expected)');
  console.log('- Email/Password endpoints may fail if:');
  console.log('  * Auth0 Password Grant is not enabled');
  console.log('  * Test user already exists (registration)');
  console.log('  * Test user does not exist (login)');
  console.log('  * Invalid credentials');
  console.log('\nTo enable Password Grant in Auth0:');
  console.log('1. Go to Auth0 Dashboard → Applications → Your App');
  console.log('2. Go to Settings → Advanced Settings → Grant Types');
  console.log('3. Enable "Password" grant type');
  console.log('4. Save changes');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);

