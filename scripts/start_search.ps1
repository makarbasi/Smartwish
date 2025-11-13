# Quick launcher for interactive card search
# Just run this file and start searching!

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  🎴 CARD SEARCH LAUNCHER 🎴" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Set your API key here (or it will ask you)
$API_KEY = ""

if (-not $API_KEY) {
    Write-Host "Please enter your Google API Key:" -ForegroundColor Yellow
    Write-Host "(Get it from: https://aistudio.google.com/app/apikey)" -ForegroundColor Gray
    $API_KEY = Read-Host "API Key"
}

if (-not $API_KEY) {
    Write-Host ""
    Write-Host "❌ No API key provided. Exiting." -ForegroundColor Red
    exit 1
}

# Set environment variable
$env:GOOGLE_API_KEY = $API_KEY

# Run the search
Write-Host ""
Write-Host "Starting interactive search..." -ForegroundColor Green
Write-Host ""

python scripts/search_cards.py

Write-Host ""
Write-Host "Search session ended. Goodbye! 👋" -ForegroundColor Cyan

