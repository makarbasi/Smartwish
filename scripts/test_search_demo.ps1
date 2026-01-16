# Demo script to test the card search
# Sets API key and runs a few example searches

# Set your API key
$API_KEY = "REPLACE_WITH_YOUR_API_KEY"

if ($API_KEY -eq "REPLACE_WITH_YOUR_API_KEY") {
    Write-Host "❌ ERROR: Please edit this script and add your API key on line 5" -ForegroundColor Red
    exit 1
}

$env:GOOGLE_API_KEY = $API_KEY

Write-Host "="*80 -ForegroundColor Cyan
Write-Host "  CARD SEARCH DEMO" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan
Write-Host ""

# Test 1: Search for funny birthday card
Write-Host "TEST 1: Searching for 'funny birthday card for best friend'" -ForegroundColor Yellow
Write-Host ""
python scripts/quick_search.py "funny birthday card for best friend" 3

Write-Host "`n`n"

# Test 2: Search for Christmas card
Write-Host "TEST 2: Searching for 'elegant Christmas card with snowman'" -ForegroundColor Yellow
Write-Host ""
python scripts/quick_search.py "elegant Christmas card with snowman" 3

Write-Host "`n`n"
Write-Host "="*80 -ForegroundColor Green
Write-Host "  Demo Complete!" -ForegroundColor Green
Write-Host "="*80 -ForegroundColor Green
Write-Host ""
Write-Host "To run interactive search:" -ForegroundColor Yellow
Write-Host "  1. Edit scripts/run_search.ps1 with your API key" -ForegroundColor Yellow
Write-Host "  2. Run: .\scripts\run_search.ps1" -ForegroundColor Yellow

