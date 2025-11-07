# Start All Services Script for Windows PowerShell
# Starts all backend services and frontend in separate windows

Write-Host "Starting all services..." -ForegroundColor Green
Write-Host ""

$projectRoot = $PSScriptRoot + "\.."
Set-Location $projectRoot

# Start Backend Gateway (Port 3001)
Write-Host "Starting Backend Gateway (Port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Backend Gateway - Port 3001' -ForegroundColor Green; npm run dev:gateway"

Start-Sleep -Seconds 2

# Start Pose Detection Service (Port 5000)
Write-Host "Starting Pose Detection Service (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Pose Detection Service - Port 5000' -ForegroundColor Green; npm run dev:pose"

Start-Sleep -Seconds 2

# Start Drill Recommender (Port 5001)
Write-Host "Starting Drill Recommender (Port 5001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Drill Recommender - Port 5001' -ForegroundColor Green; npm run dev:drills"

Start-Sleep -Seconds 2

# Start Blast Connector (Port 5002)
Write-Host "Starting Blast Connector (Port 5002)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Blast Connector - Port 5002' -ForegroundColor Green; npm run dev:blast"

Start-Sleep -Seconds 2

# Start Frontend (Port 3000)
Write-Host "Starting Frontend (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Next.js Frontend - Port 3000' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "All services starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Yellow
Write-Host "  - Backend Gateway:     http://localhost:3001" -ForegroundColor White
Write-Host "  - Pose Detection:       http://localhost:5000" -ForegroundColor White
Write-Host "  - Drill Recommender:    http://localhost:5001" -ForegroundColor White
Write-Host "  - Blast Connector:      http://localhost:5002" -ForegroundColor White
Write-Host "  - Frontend:             http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the services." -ForegroundColor Gray

