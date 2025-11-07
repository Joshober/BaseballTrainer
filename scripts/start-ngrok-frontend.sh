#!/bin/bash
# Start ngrok tunnel for the Next.js frontend server
# This script should be run on the frontend PC

echo "Starting ngrok tunnel for Next.js frontend..."
echo "Frontend server should be running on port 3000"

# Start ngrok using the config file
ngrok start baseball-frontend --config ngrok.yml

