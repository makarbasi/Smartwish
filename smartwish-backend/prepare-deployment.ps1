# Prepare Print Agent for Production Deployment
# Run this on your DEVELOPMENT machine to create a deployment package

$ErrorActionPreference = "Stop"

$deployDir = "print-agent-deployment"
$zipFile = "$deployDir.zip"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  PREPARE PRINT AGENT FOR DEPLOYMENT" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Verify we're in the right directory
if (-not (Test-Path "backend\local-print-agent.js")) {
    Write-Host "ERROR: Cannot find backend\local-print-agent.js" -ForegroundColor Red
    Write-Host "Make sure you're running this from smartwish-backend directory" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Preparing Print Agent for deployment..." -ForegroundColor Yellow
Write-Host ""

# Create deployment directory
if (Test-Path $deployDir) {
    Write-Host "Removing existing deployment directory..." -ForegroundColor Yellow
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null
Write-Host "[OK] Created deployment directory" -ForegroundColor Green

# Copy required files
Write-Host "Copying files..." -ForegroundColor Yellow
Copy-Item "backend\local-print-agent.js" "$deployDir\" -Force
Copy-Item "start-print-agent.ps1" "$deployDir\" -Force
Copy-Item "start-print-agent.bat" "$deployDir\" -Force
if (Test-Path "setup-print-agent-service.ps1") {
    Copy-Item "setup-print-agent-service.ps1" "$deployDir\" -Force
}
Write-Host "[OK] Copied required files" -ForegroundColor Green

# Create minimal package.json for production
Write-Host "Creating package.json..." -ForegroundColor Yellow
$packageJson = @{
    name = "smartwish-print-agent"
    version = "1.0.0"
    description = "SmartWish Local Print Agent - Production"
    type = "module"
    main = "local-print-agent.js"
    scripts = @{
        start = "node local-print-agent.js"
    }
    dependencies = @{
        "pdf-to-printer" = "^5.6.0"
        "pdf-lib" = "^1.17.1"
        "sharp" = "^0.33.5"
    }
    engines = @{
        node = ">=18.0.0"
    }
} | ConvertTo-Json -Depth 10

$packageJson | Out-File "$deployDir\package.json" -Encoding UTF8
Write-Host "[OK] Created package.json" -ForegroundColor Green

# Create README
Write-Host "Creating README..." -ForegroundColor Yellow
$readme = @'
# SmartWish Print Agent - Production Deployment

## Quick Start

1. Install Node.js 18+
   - Download from: https://nodejs.org/
   - Install the LTS version
   - Verify: node --version

2. Install Dependencies
   - Open PowerShell in this folder
   - Run: npm install --production

3. Configure Printer
   - Edit: start-print-agent.ps1
   - Update line 10: DEFAULT_PRINTER = "YOUR_PRINTER_NAME"
   - Find printer name in Windows Settings -> Printers & scanners

4. Configure Server URL (if different)
   - Edit: start-print-agent.ps1
   - Update line 9: CLOUD_SERVER_URL = "https://your-server.com"

5. Test Run
   - Run: .\start-print-agent.ps1
   - Verify it connects and sees your printer
   - Press Ctrl+C to stop

6. Setup Auto-Start (as Administrator)
   - Run: .\setup-print-agent-service.ps1
   - This creates a Task Scheduler task for auto-start on reboot

## Files Included

- local-print-agent.js - Main print agent script
- package.json - Production dependencies
- start-print-agent.ps1 - PowerShell startup script
- start-print-agent.bat - Batch startup script
- setup-print-agent-service.ps1 - Auto-start setup script

## Troubleshooting

- Cannot find module: Run npm install --production
- Printer not found: Check printer name matches exactly
- Cannot connect: Check internet and server URL
- Service won't start: Run setup script as Administrator

For more details, see PRODUCTION_DEPLOYMENT.md
'@

$readme | Out-File "$deployDir\README.txt" -Encoding UTF8
Write-Host "[OK] Created README.txt" -ForegroundColor Green

# Create zip
Write-Host "Creating zip archive..." -ForegroundColor Yellow
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}
Compress-Archive -Path $deployDir -DestinationPath $zipFile

$zipSize = (Get-Item $zipFile).Length / 1MB
$zipSizeFormatted = [math]::Round($zipSize, 2)
$sizeMsg = "Created deployment package: $zipFile ($zipSizeFormatted MB)"
Write-Host "[OK] $sizeMsg" -ForegroundColor Green

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT PACKAGE READY!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Transfer $zipFile to production machine" -ForegroundColor White
$extractPath = "C:\Program Files\SmartWish\PrintAgent"
Write-Host "2. Extract to permanent location" -ForegroundColor White
Write-Host "   Example: $extractPath" -ForegroundColor Gray
Write-Host "3. Open PowerShell in extracted folder" -ForegroundColor White
Write-Host "4. Run: npm install --production" -ForegroundColor White
Write-Host "5. Configure printer name in start-print-agent.ps1" -ForegroundColor White
Write-Host "6. Test: .\start-print-agent.ps1" -ForegroundColor White
Write-Host "7. Setup auto-start: .\setup-print-agent-service.ps1 (as Administrator)" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host | Out-Null

