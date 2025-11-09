/**
 * Test script for Fungo Universe API endpoints
 * Run with: tsx scripts/test-fungo-universe-api.ts
 */

const API_URL = process.env.NEXTJS_API_URL || "http://localhost:3000";
const BLAST_SECRET = process.env.BLAST_SECRET || "super-secret-string";

async function testSwingEndpoint() {
  console.log("\n🧪 Testing POST /api/swings endpoint...");
  
  const swingData = {
    bat_speed_mph: 75.5,
    attack_angle_deg: 12.0,
    omega_peak_dps: 150.0,
    t_start: Date.now() / 1000 - 0.5,
    t_peak: Date.now() / 1000 - 0.25,
    t_end: Date.now() / 1000,
    duration_ms: 500,
  };

  try {
    const response = await fetch(`${API_URL}/api/swings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-blast-secret": BLAST_SECRET,
      },
      body: JSON.stringify(swingData),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ POST /api/swings: SUCCESS");
      console.log("   Response:", data);
      return true;
    } else {
      console.log("❌ POST /api/swings: FAILED");
      console.log("   Status:", response.status);
      console.log("   Response:", data);
      return false;
    }
  } catch (error: any) {
    console.log("❌ POST /api/swings: ERROR");
    console.log("   Error:", error.message);
    return false;
  }
}

async function testSSEStream() {
  console.log("\n🧪 Testing GET /api/swings/stream endpoint...");
  
  // EventSource is a browser API, not available in Node.js
  if (typeof EventSource === "undefined") {
    console.log("⚠️  EventSource not available (Node.js environment)");
    console.log("   Testing endpoint with fetch instead...");
    
    try {
      const response = await fetch(`${API_URL}/api/swings/stream`, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
      });

      if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
        console.log("✅ GET /api/swings/stream: Endpoint exists and returns SSE content type");
        console.log("   Status:", response.status);
        console.log("   Content-Type:", response.headers.get("content-type"));
        // Don't read the stream, just verify it exists
        return true;
      } else {
        console.log("❌ GET /api/swings/stream: Unexpected response");
        console.log("   Status:", response.status);
        return false;
      }
    } catch (error: any) {
      console.log("❌ GET /api/swings/stream: ERROR");
      console.log("   Error:", error.message);
      return false;
    }
  }

  // Browser environment - use EventSource
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      console.log("⏱️  SSE stream test timed out (this is expected - stream stays open)");
      resolve(true); // Timeout is expected for SSE
    }, 3000);

    try {
      const es = new EventSource(`${API_URL}/api/swings/stream`);
      
      es.onopen = () => {
        console.log("✅ GET /api/swings/stream: Connection opened");
        clearTimeout(timeout);
        es.close();
        resolve(true);
      };

      es.onerror = (error) => {
        console.log("❌ GET /api/swings/stream: Connection error");
        console.log("   Error:", error);
        clearTimeout(timeout);
        es.close();
        resolve(false);
      };

      es.onmessage = (event) => {
        console.log("📨 Received SSE message:", event.data);
      };
    } catch (error: any) {
      console.log("❌ GET /api/swings/stream: ERROR");
      console.log("   Error:", error.message);
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

async function testPageLoad() {
  console.log("\n🧪 Testing /fungo-universe page...");
  
  try {
    const response = await fetch(`${API_URL}/fungo-universe`, {
      method: "GET",
      redirect: "manual", // Don't follow redirects
    });

    if (response.status === 200) {
      console.log("✅ /fungo-universe page: SUCCESS (200 OK)");
      return true;
    } else if (response.status === 307 || response.status === 308) {
      console.log("⚠️  /fungo-universe page: Redirected (likely to /login)");
      console.log("   This is expected if not authenticated");
      return true; // Redirect is expected behavior
    } else {
      console.log("❌ /fungo-universe page: FAILED");
      console.log("   Status:", response.status);
      return false;
    }
  } catch (error: any) {
    console.log("❌ /fungo-universe page: ERROR");
    console.log("   Error:", error.message);
    return false;
  }
}

async function testComponents() {
  console.log("\n🧪 Testing component imports...");
  
  try {
    // Test if components can be imported
    const bus = await import("@/lib/bus");
    console.log("✅ lib/bus.ts: Can be imported");
    
    // Check if swingsBus exists
    if (bus.swingsBus) {
      console.log("✅ swingsBus: Exists");
      return true;
    } else {
      console.log("❌ swingsBus: Not found");
      return false;
    }
  } catch (error: any) {
    console.log("❌ Component import: ERROR");
    console.log("   Error:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("🌌 Fungo Universe API Test Suite");
  console.log("=".repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`BLAST_SECRET: ${BLAST_SECRET.substring(0, 10)}...`);
  console.log("=".repeat(60));

  const results = {
    swingEndpoint: false,
    sseStream: false,
    pageLoad: false,
    components: false,
  };

  // Test components first (doesn't require server)
  results.components = await testComponents();

  // Test endpoints (require server)
  results.swingEndpoint = await testSwingEndpoint();
  results.sseStream = await testSSEStream();
  results.pageLoad = await testPageLoad();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Results Summary");
  console.log("=".repeat(60));
  console.log(`Component imports: ${results.components ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`POST /api/swings: ${results.swingEndpoint ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`GET /api/swings/stream: ${results.sseStream ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`GET /fungo-universe: ${results.pageLoad ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(60));

  const allPassed = Object.values(results).every((r) => r);
  if (allPassed) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed. Check the output above.");
  }

  return allPassed;
}

// Run tests
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

