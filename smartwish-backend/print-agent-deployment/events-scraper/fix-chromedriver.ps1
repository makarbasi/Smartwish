# ChromeDriver Fix Script
# This script clears the webdriver-manager cache and reinstalls dependencies

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "ChromeDriver Fix Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Clear webdriver-manager cache
Write-Host "Clearing webdriver-manager cache..." -ForegroundColor Yellow
$wdmPath = "$env:USERPROFILE\.wdm"
if (Test-Path $wdmPath) {
    Remove-Item -Path $wdmPath -Recurse -Force
    Write-Host "✅ Cache cleared: $wdmPath" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No cache found at $wdmPath" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Upgrading Python packages..." -ForegroundColor Yellow
pip install --upgrade pip
pip install --upgrade selenium webdriver-manager requests

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ Fix Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Now try running the scraper again:" -ForegroundColor Cyan
Write-Host "  python scrape_events.py" -ForegroundColor White
Write-Host ""
