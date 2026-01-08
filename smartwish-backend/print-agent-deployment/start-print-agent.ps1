# PowerShell script to run the Local Print Agent

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH LOCAL PRINT AGENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Edit these values
$env:CLOUD_SERVER_URL = "http://localhost:3001"
# $env:CLOUD_SERVER_URL = "https://smartwish.onrender.com"
$env:POLL_INTERVAL = "5000"

# Printer name comes from kiosk config (/admin/kiosks) via the print job
# Only set this if you want a fallback when job doesn't specify printer
# $env:DEFAULT_PRINTER = "HPIE4B65B (HP OfficeJet Pro 9130e Series)"

# Explicitly clear any previously set DEFAULT_PRINTER to ensure we use kiosk config
if ($env:DEFAULT_PRINTER) {
  Remove-Item Env:\DEFAULT_PRINTER -ErrorAction SilentlyContinue
}

# Duplex setting: simplex | duplex | duplexshort | duplexlong
# For greeting cards (landscape fold): use duplexshort
$env:DEFAULT_DUPLEX_SIDE = "duplexshort"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $env:CLOUD_SERVER_URL"
Write-Host "  Poll Interval: $env:POLL_INTERVAL ms"
Write-Host "  Duplex: $env:DEFAULT_DUPLEX_SIDE"
if ($env:DEFAULT_PRINTER) {
  Write-Host "  Fallback Printer: $env:DEFAULT_PRINTER" -ForegroundColor Gray
}
Write-Host ""
Write-Host "NOTE: Printer name comes from kiosk config (/admin/kiosks)" -ForegroundColor Cyan
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
