# PowerShell Script to Push to GitHub
# Run this after killing the stuck terminal

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🚀 PUSHING TO GITHUB" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to project root
Set-Location "C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Code\Smartwish"

Write-Host "📍 Current directory: $(Get-Location)" -ForegroundColor Yellow

# Configure Git credential helper (stores credentials)
Write-Host "`n🔧 Configuring Git credential helper..." -ForegroundColor Yellow
git config --global credential.helper manager-core

# Check current branch and status
Write-Host "`n📊 Git Status:" -ForegroundColor Yellow
git status

Write-Host "`n📝 Recent commits:" -ForegroundColor Yellow
git log --oneline -3

# Attempt to push
Write-Host "`n🚀 Attempting push with force-with-lease..." -ForegroundColor Green
Write-Host "⚠️  You may be prompted for GitHub credentials" -ForegroundColor Yellow
Write-Host "    Use your GitHub username and Personal Access Token (PAT)" -ForegroundColor Yellow
Write-Host "`n" -ForegroundColor Yellow

# This will prompt for credentials ONCE and store them
git push --force-with-lease origin development

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ PUSH SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ PUSH FAILED" -ForegroundColor Red
    Write-Host "Error code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you used a Personal Access Token (PAT), not password" -ForegroundColor Yellow
    Write-Host "2. Get PAT from: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "3. Select scope: 'repo'" -ForegroundColor Yellow
    Write-Host "`n========================================`n" -ForegroundColor Cyan
}








