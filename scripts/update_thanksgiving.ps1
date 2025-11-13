# Quick script to update Thanksgiving category

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "  Update Thanksgiving Category to sw_templates" -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Install dependencies if needed
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pip install -q supabase python-dotenv

Write-Host ""
Write-Host "Running dry-run first (preview)..." -ForegroundColor Cyan
Write-Host ""

# Dry run
python scripts/update_single_category.py FallGreetingCardBundlePDF --dry-run

Write-Host ""
$proceed = Read-Host "Upload these cards to Supabase? [y/N]"

if ($proceed -eq "y" -or $proceed -eq "Y") {
    Write-Host ""
    Write-Host "Uploading to Supabase..." -ForegroundColor Yellow
    Write-Host ""
    
    python scripts/update_single_category.py FallGreetingCardBundlePDF
    
    Write-Host ""
    Write-Host "=" -NoNewline -ForegroundColor Cyan
    Write-Host ("=" * 79) -ForegroundColor Cyan
    Write-Host "  Complete!" -ForegroundColor Green
    Write-Host "=" -NoNewline -ForegroundColor Cyan
    Write-Host ("=" * 79) -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Cancelled." -ForegroundColor Yellow
}

