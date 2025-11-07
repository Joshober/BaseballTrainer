# PowerShell script wrapper for model installation
# This script runs the TypeScript installation script

Write-Host "Installing AI models for Baseball Swing Analysis..." -ForegroundColor Cyan
Write-Host ""

# Check if tsx is available
if (-not (Get-Command tsx -ErrorAction SilentlyContinue)) {
    Write-Host "Error: tsx is not installed." -ForegroundColor Red
    Write-Host "Please install it with: npm install -g tsx" -ForegroundColor Yellow
    Write-Host "Or run: npm install" -ForegroundColor Yellow
    exit 1
}

# Run the TypeScript script
tsx scripts/install-models.ts

