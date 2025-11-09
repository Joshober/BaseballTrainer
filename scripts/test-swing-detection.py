#!/usr/bin/env python3
"""
Test script for swing detection integration (Python version)
Tests the swing detection API endpoints and video recording integration
"""

import requests
import json
import time
import sys
import os
from typing import Dict, Any, Optional

BLAST_CONNECTOR_URL = os.getenv('BLAST_CONNECTOR_URL', 'http://localhost:5002')
NEXTJS_URL = os.getenv('NEXTJS_URL', 'http://localhost:3000')

all_tests_passed = True


def test_endpoint(
    name: str,
    method: str,
    url: str,
    expected_status: int = 200,
    body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None
) -> bool:
    """Test an API endpoint"""
    global all_tests_passed
    try:
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)

        if method.upper() == 'GET':
            response = requests.get(url, headers=request_headers, timeout=5)
        elif method.upper() == 'POST':
            response = requests.post(
                url,
                json=body,
                headers=request_headers,
                timeout=5
            )
        else:
            print(f"❌ {name}: Unsupported method {method}")
            return False

        status = response.status_code
        try:
            data = response.json()
        except:
            data = {}

        if status == expected_status:
            print(f"✅ {name}: PASSED ({status})")
            return True
        else:
            print(f"❌ {name}: FAILED")
            print(f"   Expected: {expected_status}, Got: {status}")
            print(f"   Response: {json.dumps(data, indent=2)}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ {name}: CONNECTION ERROR")
        print(f"   Could not connect to {url}")
        print(f"   Make sure the service is running")
        return False
    except Exception as e:
        print(f"❌ {name}: ERROR")
        print(f"   {str(e)}")
        return False


def run_tests():
    """Run all tests"""
    global all_tests_passed

    print("=" * 60)
    print("Testing Swing Detection Integration")
    print("=" * 60)
    print(f"Blast Connector URL: {BLAST_CONNECTOR_URL}")
    print(f"Next.js URL: {NEXTJS_URL}\n")

    # Test 1: Check if blast connector is running
    print("\n1. Testing Blast Connector Health...")
    health_passed = test_endpoint(
        'Blast Connector Health',
        'GET',
        f'{BLAST_CONNECTOR_URL}/health',
        200
    )
    all_tests_passed = all_tests_passed and health_passed

    # Test 2: Check swing detection status
    print("\n2. Testing Swing Detection Status...")
    status_passed = test_endpoint(
        'Swing Detection Status',
        'GET',
        f'{BLAST_CONNECTOR_URL}/api/blast/swings/status',
        200
    )
    all_tests_passed = all_tests_passed and status_passed

    # Test 3: Start swing detection
    print("\n3. Testing Start Swing Detection...")
    test_session_id = f'test-session-{int(time.time())}'
    start_passed = test_endpoint(
        'Start Swing Detection',
        'POST',
        f'{BLAST_CONNECTOR_URL}/api/blast/swings/start',
        200,
        {'sessionId': test_session_id}
    )
    if not start_passed:
        print("   ⚠️  Note: This may fail if bat is not connected (expected)")
    all_tests_passed = all_tests_passed and start_passed

    # Test 4: Check swing detection status again
    print("\n4. Testing Swing Detection Status After Start...")
    status_after_passed = test_endpoint(
        'Swing Detection Status After Start',
        'GET',
        f'{BLAST_CONNECTOR_URL}/api/blast/swings/status',
        200
    )
    all_tests_passed = all_tests_passed and status_after_passed

    # Test 5: Stop swing detection
    print("\n5. Testing Stop Swing Detection...")
    stop_passed = test_endpoint(
        'Stop Swing Detection',
        'POST',
        f'{BLAST_CONNECTOR_URL}/api/blast/swings/stop',
        200
    )
    all_tests_passed = all_tests_passed and stop_passed

    # Test 6: Test Next.js swing data API (POST)
    print("\n6. Testing Next.js Swing Data API (POST)...")
    now = time.time()
    mock_swing_data = {
        't_start': now - 0.5,
        't_peak': now - 0.25,
        't_end': now,
        'duration_ms': 500,
        'omega_peak_dps': 150.5,
        'bat_speed_mph': 75.3,
        'attack_angle_deg': 12.5,
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(now)),
        'sessionId': f'test-session-{int(time.time())}',
    }
    swing_data_passed = test_endpoint(
        'Post Swing Data to Next.js',
        'POST',
        f'{NEXTJS_URL}/api/blast/swings',
        200,
        mock_swing_data
    )
    all_tests_passed = all_tests_passed and swing_data_passed

    # Test 7: Test Next.js swing data API (GET)
    print("\n7. Testing Next.js Swing Data API (GET)...")
    session_id = mock_swing_data['sessionId']
    time.sleep(0.5)  # Wait a bit for data to be stored
    get_swing_data_passed = test_endpoint(
        'Get Swing Data from Next.js',
        'GET',
        f'{NEXTJS_URL}/api/blast/swings?sessionId={session_id}',
        200
    )
    all_tests_passed = all_tests_passed and get_swing_data_passed

    # Test 8: Test Next.js swing data API (GET - non-existent session)
    print("\n8. Testing Next.js Swing Data API (GET - non-existent)...")
    non_existent_passed = test_endpoint(
        'Get Swing Data for Non-existent Session',
        'GET',
        f'{NEXTJS_URL}/api/blast/swings?sessionId=non-existent-{int(time.time())}',
        200
    )
    all_tests_passed = all_tests_passed and non_existent_passed

    # Summary
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("✅ All tests passed!")
        print("\nNext steps:")
        print("  1. Make sure your bat is connected (BLAST@MOTION device)")
        print("  2. Go to http://localhost:3000/videos")
        print("  3. Click 'Record' button")
        print("  4. Swing detection should start automatically")
        print("  5. Recording will stop when swing data is received")
    else:
        print("❌ Some tests failed. Please check the errors above.")
        print("\nTroubleshooting:")
        print("  1. Make sure blast-connector is running: cd blast-connector && python app.py")
        print("  2. Make sure Next.js is running: npm run dev")
        print("  3. Check if services are on correct ports (5002 for blast-connector, 3000 for Next.js)")
        print("  4. Check environment variables in .env.local")
    print("=" * 60 + "\n")

    return 0 if all_tests_passed else 1


if __name__ == '__main__':
    sys.exit(run_tests())


