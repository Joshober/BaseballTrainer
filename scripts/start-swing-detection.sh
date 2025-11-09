#!/bin/bash
# Bash script to start swing detection
# Usage: ./scripts/start-swing-detection.sh <SESSION_ID> [API_URL]

SESSION_ID=$1
API_URL=${2:-"http://localhost:3000"}

if [ -z "$SESSION_ID" ]; then
    echo "Usage: $0 <SESSION_ID> [API_URL]"
    echo "Example: $0 abc-123-def-456"
    exit 1
fi

echo "Starting swing detection..."
echo "Session ID: $SESSION_ID"
echo "API URL: $API_URL"
echo ""

python scripts/detect_swings.py --session-id "$SESSION_ID" --api-url "$API_URL"


