# PowerShell script to setup SmartWish Print Agent as Windows Service using Task Scheduler
# Run this script as Administrator

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH PRINT AGENT - AUTO-START SETUP" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$printAgentScript = Join-Path $scriptDir "start-print-agent.ps1"

# Verify the print agent script exists
if (-not (Test-Path $printAgentScript)) {
    Write-Host "ERROR: Cannot find start-print-agent.ps1 at: $printAgentScript" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Script location: $printAgentScript" -ForegroundColor Green
Write-Host ""

# Create Task Scheduler task
$taskName = "SmartWishPrintAgent"
$taskDescription = "Starts SmartWish local print agent on system startup"

Write-Host "Creating Task Scheduler task: $taskName" -ForegroundColor Yellow

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction `
    -Execute "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$printAgentScript`"" `
    -WorkingDirectory $scriptDir

# Create the trigger (on system startup)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Create principal (run as SYSTEM with highest privileges)
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description $taskDescription `
        -Force | Out-Null
    
    Write-Host ""
    Write-Host "SUCCESS: Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $taskName"
    Write-Host "  Trigger: System Startup"
    Write-Host "  Script: $printAgentScript"
    Write-Host ""
    Write-Host "The print agent will now start automatically on system reboot." -ForegroundColor Green
    Write-Host ""
    Write-Host "To test it now, run:" -ForegroundColor Yellow
    Write-Host "  Start-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor White
    Write-Host ""
    Write-Host "To view task status:" -ForegroundColor Yellow
    Write-Host "  Get-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor White
    Write-Host ""
    Write-Host "To remove the task:" -ForegroundColor Yellow
    Write-Host "  Unregister-ScheduledTask -TaskName `"$taskName`" -Confirm:`$false" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create task" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

