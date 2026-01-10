# PowerShell script to run the Local Print Agent
param(
    [switch]$Dev,
    [switch]$NoBrowser
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Edit these values
if ($Dev) {
    $env:CLOUD_SERVER_URL = "http://localhost:3001"
    Write-Host "  MODE: DEVELOPMENT" -ForegroundColor Yellow
} else {
    $env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
    Write-Host "  MODE: PRODUCTION" -ForegroundColor Green
}
$env:DEFAULT_PRINTER = "HPA4CC43 (HP Smart Tank 7600 series)"
$env:POLL_INTERVAL = "5000"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Printer: $env:DEFAULT_PRINTER"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host ""

# ===============================================
# OPEN BROWSER IN FULLSCREEN KIOSK MODE
# ===============================================
if (-not $NoBrowser) {
    Write-Host "Opening manager login page in fullscreen..." -ForegroundColor Green
    $loginUrl = "$env:CLOUD_SERVER_URL/managers/login"
    
    # Try Chrome first (most common)
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    $chromePathX86 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    
    if (Test-Path $chromePath) {
        Start-Process $chromePath -ArgumentList "--kiosk", "--start-fullscreen", $loginUrl
    } elseif (Test-Path $chromePathX86) {
        Start-Process $chromePathX86 -ArgumentList "--kiosk", "--start-fullscreen", $loginUrl
    } else {
        # Fallback to Edge (comes with Windows)
        $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        if (Test-Path $edgePath) {
            Start-Process $edgePath -ArgumentList "--kiosk", "--start-fullscreen", $loginUrl
        } else {
            Write-Host "  Could not find Chrome or Edge. Opening in default browser..." -ForegroundColor Yellow
            Start-Process $loginUrl
        }
    }
    
    # Wait for browser to launch
    Start-Sleep -Seconds 2
}

# Run the agent (located in this directory)
node local-print-agent.js
