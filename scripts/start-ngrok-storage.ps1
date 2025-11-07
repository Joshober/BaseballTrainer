# PowerShell script to start ngrok tunnel for the Storage Server
# This script should be run on the PC where the storage server is running

Write-Host "Starting ngrok tunnel for Storage Server..." -ForegroundColor Green
Write-Host "Storage server should be running on port 5003" -ForegroundColor Yellow

# Start ngrok using the config file
ngrok start baseball-storage --config ngrok.yml

