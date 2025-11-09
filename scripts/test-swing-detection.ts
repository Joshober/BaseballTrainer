/**
 * Test script for swing detection integration
 * Tests the swing detection API endpoints and video recording integration
 */

const BLAST_CONNECTOR_URL = process.env.BLAST_CONNECTOR_URL || 'http://localhost:5002';
const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000';

let allTestsPassed = true;

async function testEndpoint(
  name: string,
  method: string,
  url: string,
  expectedStatus: number = 200,
  body?: any,
  headers?: Record<string, string>
) {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const status = response.status;
    const data = await response.json().catch(() => ({}));

    if (status === expectedStatus) {
      console.log(`✅ ${name}: PASSED (${status})`);
      return true;
    } else {
      console.log(`❌ ${name}: FAILED`);
      console.log(`   Expected: ${expectedStatus}, Got: ${status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.log(`❌ ${name}: ERROR`);
    console.log(`   ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Testing Swing Detection Integration');
  console.log('='.repeat(60));
  console.log(`Blast Connector URL: ${BLAST_CONNECTOR_URL}`);
  console.log(`Next.js URL: ${NEXTJS_URL}\n`);

  // Test 1: Check if blast connector is running
  console.log('\n1. Testing Blast Connector Health...');
  const healthPassed = await testEndpoint(
    'Blast Connector Health',
    'GET',
    `${BLAST_CONNECTOR_URL}/health`,
    200
  );
  allTestsPassed = allTestsPassed && healthPassed;

  // Test 2: Check swing detection status (should work without auth in demo mode)
  console.log('\n2. Testing Swing Detection Status...');
  const statusPassed = await testEndpoint(
    'Swing Detection Status',
    'GET',
    `${BLAST_CONNECTOR_URL}/api/blast/swings/status`,
    200
  );
  allTestsPassed = allTestsPassed && statusPassed;

  // Test 3: Start swing detection (will fail if bat not connected, but should not error)
  console.log('\n3. Testing Start Swing Detection...');
  const startPassed = await testEndpoint(
    'Start Swing Detection',
    'POST',
    `${BLAST_CONNECTOR_URL}/api/blast/swings/start`,
    200,
    { sessionId: 'test-session-' + Date.now() }
  );
  // This might fail if bat is not connected, so we'll accept 200 or 400
  if (startPassed) {
    allTestsPassed = allTestsPassed;
  } else {
    console.log('   ⚠️  Note: This may fail if bat is not connected (expected)');
  }

  // Test 4: Check swing detection status again
  console.log('\n4. Testing Swing Detection Status After Start...');
  const statusAfterPassed = await testEndpoint(
    'Swing Detection Status After Start',
    'GET',
    `${BLAST_CONNECTOR_URL}/api/blast/swings/status`,
    200
  );
  allTestsPassed = allTestsPassed && statusAfterPassed;

  // Test 5: Stop swing detection
  console.log('\n5. Testing Stop Swing Detection...');
  const stopPassed = await testEndpoint(
    'Stop Swing Detection',
    'POST',
    `${BLAST_CONNECTOR_URL}/api/blast/swings/stop`,
    200
  );
  allTestsPassed = allTestsPassed && stopPassed;

  // Test 6: Test Next.js swing data API (POST)
  console.log('\n6. Testing Next.js Swing Data API (POST)...');
  const mockSwingData = {
    t_start: Date.now() / 1000 - 0.5,
    t_peak: Date.now() / 1000 - 0.25,
    t_end: Date.now() / 1000,
    duration_ms: 500,
    omega_peak_dps: 150.5,
    bat_speed_mph: 75.3,
    attack_angle_deg: 12.5,
    timestamp: new Date().toISOString(),
    sessionId: 'test-session-' + Date.now(),
  };
  const swingDataPassed = await testEndpoint(
    'Post Swing Data to Next.js',
    'POST',
    `${NEXTJS_URL}/api/blast/swings`,
    200,
    mockSwingData
  );
  allTestsPassed = allTestsPassed && swingDataPassed;

  // Test 7: Test Next.js swing data API (GET - check if data was received)
  console.log('\n7. Testing Next.js Swing Data API (GET)...');
  const sessionId = mockSwingData.sessionId;
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit for data to be stored
  const getSwingDataPassed = await testEndpoint(
    'Get Swing Data from Next.js',
    'GET',
    `${NEXTJS_URL}/api/blast/swings?sessionId=${sessionId}`,
    200
  );
  allTestsPassed = allTestsPassed && getSwingDataPassed;

  // Test 8: Test Next.js swing data API (GET - non-existent session)
  console.log('\n8. Testing Next.js Swing Data API (GET - non-existent)...');
  const nonExistentPassed = await testEndpoint(
    'Get Swing Data for Non-existent Session',
    'GET',
    `${NEXTJS_URL}/api/blast/swings?sessionId=non-existent-${Date.now()}`,
    200
  );
  allTestsPassed = allTestsPassed && nonExistentPassed;

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('✅ All tests passed!');
    console.log('\nNext steps:');
    console.log('  1. Make sure your bat is connected (BLAST@MOTION device)');
    console.log('  2. Go to http://localhost:3000/videos');
    console.log('  3. Click "Record" button');
    console.log('  4. Swing detection should start automatically');
    console.log('  5. Recording will stop when swing data is received');
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure blast-connector is running: cd blast-connector && python app.py');
    console.log('  2. Make sure Next.js is running: npm run dev');
    console.log('  3. Check if services are on correct ports (5002 for blast-connector, 3000 for Next.js)');
    console.log('  4. Check environment variables in .env.local');
  }
  console.log('='.repeat(60) + '\n');
}

// Run tests
runTests().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});


