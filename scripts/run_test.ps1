# PowerShell script to test API key
# Usage: .\scripts\run_test.ps1

# ⚠️ REPLACE THIS WITH YOUR API KEY FROM: https://aistudio.google.com/app/apikey
$API_KEY = "REPLACE_WITH_YOUR_API_KEY"

# Check if API key was replaced
if ($API_KEY -eq "REPLACE_WITH_YOUR_API_KEY") {
    Write-Host "❌ ERROR: Please edit this script and replace the API key!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "  1. Get your API key from: https://aistudio.google.com/app/apikey" -ForegroundColor Yellow
    Write-Host "  2. Edit this file: scripts/run_test.ps1" -ForegroundColor Yellow
    Write-Host "  3. Replace 'REPLACE_WITH_YOUR_API_KEY' with your actual key" -ForegroundColor Yellow
    Write-Host "  4. Save and run again" -ForegroundColor Yellow
    exit 1
}

# Set environment variable
$env:GOOGLE_API_KEY = $API_KEY

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing API Key" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing API key: $($API_KEY.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host ""

python scripts/test_api_key.py

