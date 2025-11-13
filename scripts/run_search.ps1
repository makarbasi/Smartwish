# PowerShell script to run card search
# Usage: .\scripts\run_search.ps1

# ⚠️ REPLACE THIS WITH YOUR API KEY FROM: https://aistudio.google.com/app/apikey
$API_KEY = "REPLACE_WITH_YOUR_API_KEY"

# Check if API key was replaced
if ($API_KEY -eq "REPLACE_WITH_YOUR_API_KEY") {
    Write-Host "❌ ERROR: Please edit this script and replace the API key!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Edit line 5 in scripts/run_search.ps1" -ForegroundColor Yellow
    exit 1
}

# Set environment variable
$env:GOOGLE_API_KEY = $API_KEY

# Run the search script
python scripts/search_cards.py

