# PowerShell script to update sw_templates table in Supabase
# This script installs dependencies and runs the update

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "  Supabase sw_templates Update Script" -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "[1/4] Checking Python installation..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python not found! Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Install requirements
Write-Host ""
Write-Host "[2/4] Installing dependencies..." -ForegroundColor Cyan
try {
    pip install -r scripts/requirements_supabase.txt --quiet
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Ask user if they want to do a dry run first
Write-Host ""
Write-Host "[3/4] Preparation complete" -ForegroundColor Cyan
Write-Host ""
$dryRun = Read-Host "Do you want to run in DRY-RUN mode first? (recommended) [Y/n]"

if ($dryRun -eq "" -or $dryRun -eq "Y" -or $dryRun -eq "y") {
    Write-Host ""
    Write-Host "[4/4] Running DRY-RUN (preview only)..." -ForegroundColor Cyan
    Write-Host ""
    python scripts/update_sw_templates.py --dry-run
    
    Write-Host ""
    $proceed = Read-Host "Do you want to proceed with the actual update? [y/N]"
    
    if ($proceed -eq "y" -or $proceed -eq "Y") {
        Write-Host ""
        Write-Host "Running ACTUAL update..." -ForegroundColor Yellow
        Write-Host ""
        python scripts/update_sw_templates.py
    } else {
        Write-Host ""
        Write-Host "Update cancelled." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[4/4] Running ACTUAL update..." -ForegroundColor Yellow
    Write-Host ""
    python scripts/update_sw_templates.py
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "  Complete!" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

