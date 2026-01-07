# PowerShell script to run the Local Print Agent
# Can be run manually or via Task Scheduler for auto-start

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Get the script's directory (works when run from Task Scheduler too)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Configuration - Edit these values
$env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
$env:DEFAULT_PRINTER = "HP OfficeJet Pro 9130e Series [HPIE4B65B]"
$env:POLL_INTERVAL = "5000"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Printer: $env:DEFAULT_PRINTER"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host "  Working Dir: $ScriptDir"
Write-Host ""

# Check if Node.js is available
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "ERROR: Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

# Check if dependencies are installed
$packageJsonPath = Join-Path $ScriptDir "package.json"
$nodeModulesPath = Join-Path $ScriptDir "node_modules"
if ((Test-Path $packageJsonPath) -and (-not (Test-Path $nodeModulesPath))) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Run the agent
Write-Host "Starting print agent..." -ForegroundColor Green
Write-Host ""
node local-print-agent.js

