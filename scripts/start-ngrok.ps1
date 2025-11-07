# PowerShell script to start ngrok tunnel for the Express backend server
# This script should be run on the backend PC

Write-Host "Starting ngrok tunnel for Express backend..." -ForegroundColor Green
Write-Host "Backend server should be running on port 3001" -ForegroundColor Yellow

# Start ngrok using the config file
ngrok start baseball-backend --config ngrok.yml

