# Events Scraper Setup Script
# This script installs Python dependencies for the Events Scraper

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Events Scraper Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Clearing webdriver-manager cache..." -ForegroundColor Yellow
$wdmPath = "$env:USERPROFILE\.wdm"
if (Test-Path $wdmPath) {
    Remove-Item -Path $wdmPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared cache" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installing/Upgrading Python dependencies..." -ForegroundColor Yellow
pip install --upgrade pip
pip install --upgrade -r requirements.txt

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "The Events Scraper is now ready to use." -ForegroundColor White
Write-Host "It will run automatically when the print agent starts." -ForegroundColor White
Write-Host ""
Write-Host "To test manually, run:" -ForegroundColor Cyan
Write-Host "  python scrape_events.py" -ForegroundColor White
Write-Host ""
