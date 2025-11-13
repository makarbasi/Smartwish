# PowerShell script to run embedding generation
# Usage: Edit the API key below, then run: .\scripts\run_embeddings.ps1

# ⚠️ REPLACE THIS WITH YOUR API KEY FROM: https://aistudio.google.com/app/apikey
$API_KEY = "REPLACE_WITH_YOUR_API_KEY"

# Check if API key was replaced
if ($API_KEY -eq "REPLACE_WITH_YOUR_API_KEY") {
    Write-Host "❌ ERROR: Please edit this script and replace the API key!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "  1. Get your API key from: https://aistudio.google.com/app/apikey" -ForegroundColor Yellow
    Write-Host "  2. Edit this file: scripts/run_embeddings.ps1" -ForegroundColor Yellow
    Write-Host "  3. Replace 'REPLACE_WITH_YOUR_API_KEY' with your actual key" -ForegroundColor Yellow
    Write-Host "  4. Save and run again" -ForegroundColor Yellow
    exit 1
}

# Set environment variable
$env:GOOGLE_API_KEY = $API_KEY

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Embedding Generation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Key: $($API_KEY.Substring(0, 20))..." -ForegroundColor Green
Write-Host ""
Write-Host "Starting embedding generation..." -ForegroundColor Yellow
Write-Host ""

# Run the Python script
python scripts/generate_embeddings.py

# Check if successful
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Embedding generation completed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ Error occurred during execution" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Run test first: python scripts/test_api_key.py" -ForegroundColor Yellow
    Write-Host "  2. Check API_KEY_SETUP_GUIDE.md for help" -ForegroundColor Yellow
}

