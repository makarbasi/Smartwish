# PowerShell script to run the Local Print Agent

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Edit these values
$env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
$env:DEFAULT_PRINTER = "HP OfficeJet Pro 9130e Series [HPIE4B65B]"
$env:POLL_INTERVAL = "5000"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Printer: $env:DEFAULT_PRINTER"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host ""

# Run the agent (located in backend/ subdirectory)
node backend/local-print-agent.js

