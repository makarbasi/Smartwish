# PowerShell script to run the Local Print Agent

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Edit these values
$env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
$env:DEFAULT_PRINTER = "HPA4CC43 (HP Smart Tank 7600 series)"
$env:POLL_INTERVAL = "5000"

# Printing defaults (can be overridden per job)
# Duplex: simplex | duplex | duplexshort | duplexlong
$env:DEFAULT_DUPLEX_SIDE = "duplexshort"
# Borderless: true/false. True tries to select a borderless paper size if available.
$env:BORDERLESS = "true"
# Optional: exact paper size name exposed by your printer driver (recommended).
# Examples: "Letter (Borderless)", "A4 (Borderless)"
$env:BORDERLESS_PAPER_SIZE = "Letter (Borderless)"
# Default paper size when BORDERLESS paper isn't available
$env:DEFAULT_PAPER_SIZE = "Letter"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Printer: $env:DEFAULT_PRINTER"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host "  Duplex: $env:DEFAULT_DUPLEX_SIDE"
Write-Host "  Borderless: $env:BORDERLESS"
Write-Host "  Borderless Paper: $env:BORDERLESS_PAPER_SIZE"
Write-Host "  Default Paper: $env:DEFAULT_PAPER_SIZE"
Write-Host ""

# Ensure dependencies are installed (node_modules)
$nodeModulesDir = Join-Path $PSScriptRoot "node_modules"
if (-not (Test-Path $nodeModulesDir)) {
  Write-Host "Dependencies not found (node_modules missing). Installing..." -ForegroundColor Yellow
  npm install --omit=dev
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed. Install Node.js 18/20 LTS and try again." -ForegroundColor Red
    exit 1
  }
  Write-Host "Dependencies installed." -ForegroundColor Green
  Write-Host ""
}

# Sanity check: ensure local-print-agent.js wasn't accidentally duplicated/concatenated
$agentPath = Join-Path $PSScriptRoot "local-print-agent.js"
if (-not (Test-Path $agentPath)) {
  Write-Host "ERROR: Cannot find local-print-agent.js at: $agentPath" -ForegroundColor Red
  exit 1
}
$dupImports = (Select-String -Path $agentPath -SimpleMatch "import pdfPrinter from 'pdf-to-printer'" -ErrorAction SilentlyContinue).Count
if ($dupImports -gt 1) {
  Write-Host "ERROR: local-print-agent.js appears to contain duplicated code (pdf-to-printer import found $dupImports times)." -ForegroundColor Red
  Write-Host "Fix: replace this folder with a fresh copy of print-agent-deployment (or re-extract the zip) and try again." -ForegroundColor Yellow
  exit 1
}

# Run the agent (this folder)
node local-print-agent.js

