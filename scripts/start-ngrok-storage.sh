#!/bin/bash
# Start ngrok tunnel for the Storage Server
# This script should be run on the PC where the storage server is running

echo "Starting ngrok tunnel for Storage Server..."
echo "Storage server should be running on port 5003"

# Start ngrok using the config file
ngrok start baseball-storage --config ngrok.yml

