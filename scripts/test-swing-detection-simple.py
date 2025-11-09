#!/usr/bin/env python3
"""
Simple test script for swing detection - checks if services are running
"""
import requests
import sys
import os

BLAST_CONNECTOR_URL = os.getenv('BLAST_CONNECTOR_URL', 'http://localhost:5002')
NEXTJS_URL = os.getenv('NEXTJS_URL', 'http://localhost:3000')

def test_service(name, url):
    """Test if a service is running"""
    try:
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            print(f"✅ {name}: Running")
            return True
        else:
            print(f"❌ {name}: Not responding (Status: {response.status_code})")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ {name}: Not running (Connection refused)")
        return False
    except Exception as e:
        print(f"❌ {name}: Error - {e}")
        return False

def main():
    print("=" * 60)
    print("Testing Swing Detection Services")
    print("=" * 60)
    print(f"Blast Connector URL: {BLAST_CONNECTOR_URL}")
    print(f"Next.js URL: {NEXTJS_URL}\n")
    
    # Test services
    blast_ok = test_service("Blast Connector", f"{BLAST_CONNECTOR_URL}/health")
    nextjs_ok = test_service("Next.js", f"{NEXTJS_URL}/api/health" if hasattr(requests, 'get') else f"{NEXTJS_URL}")
    
    print("\n" + "=" * 60)
    if blast_ok and nextjs_ok:
        print("✅ All services are running!")
        print("\nNext steps:")
        print("  1. Make sure your bat is connected (BLAST@MOTION device)")
        print("  2. Go to http://localhost:3000/videos")
        print("  3. Click 'Record' button")
        print("  4. Swing detection should start automatically")
    else:
        print("❌ Some services are not running")
        print("\nTo start services:")
        print("  1. Blast Connector: npm run dev:blast")
        print("  2. Next.js: npm run dev")
    print("=" * 60)
    
    return 0 if (blast_ok and nextjs_ok) else 1

if __name__ == '__main__':
    sys.exit(main())


