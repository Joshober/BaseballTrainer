# PowerShell script to start ngrok tunnel for the Next.js frontend server
# This script should be run on the frontend PC

Write-Host "Starting ngrok tunnel for Next.js frontend..." -ForegroundColor Green
Write-Host "Frontend server should be running on port 3000" -ForegroundColor Yellow

# Start ngrok using the config file
ngrok start baseball-frontend --config ngrok.yml

