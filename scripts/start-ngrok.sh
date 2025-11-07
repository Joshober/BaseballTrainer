#!/bin/bash
# Start ngrok tunnel for the Express backend server
# This script should be run on the backend PC

echo "Starting ngrok tunnel for Express backend..."
echo "Backend server should be running on port 3001"

# Start ngrok using the config file
ngrok start baseball-backend --config ngrok.yml

