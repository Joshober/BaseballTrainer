# PowerShell script to start swing detection
# Usage: .\scripts\start-swing-detection.ps1 -SessionId "abc-123-def"

param(
    [Parameter(Mandatory=$true)]
    [string]$SessionId,
    
    [string]$ApiUrl = "http://localhost:3000"
)

Write-Host "Starting swing detection..." -ForegroundColor Green
Write-Host "Session ID: $SessionId" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host ""

python scripts/detect_swings.py --session-id $SessionId --api-url $ApiUrl


