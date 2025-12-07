# PowerShell script to run the Local Print Agent

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Edit these values
$env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
$env:DEFAULT_PRINTER = "HPA4CC43 (HP Smart Tank 7600 series)"
$env:POLL_INTERVAL = "5000"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Printer: $env:DEFAULT_PRINTER"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host ""

# Run the agent
node local-print-agent.js

