# PowerShell script to setup SmartWish Print Agent to start automatically
# Provides two options: Task Scheduler (recommended) or Startup Folder (simpler)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SMARTWISH PRINT AGENT - AUTO-START SETUP" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$printAgentScript = Join-Path $scriptDir "start-print-agent.ps1"
$printAgentBat = Join-Path $scriptDir "start-print-agent.bat"

# Verify the print agent script exists
if (-not (Test-Path $printAgentScript)) {
    Write-Host "ERROR: Cannot find start-print-agent.ps1 at: $printAgentScript" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Print Agent location: $scriptDir" -ForegroundColor Green
Write-Host ""
Write-Host "Choose auto-start method:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Startup Folder (RECOMMENDED - Simple, runs when you log in)" -ForegroundColor White
Write-Host "  2. Task Scheduler (Runs at system boot, requires Admin)" -ForegroundColor White
Write-Host "  3. Remove auto-start" -ForegroundColor White
Write-Host "  4. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        # =============================================
        # OPTION 1: Startup Folder (Recommended)
        # =============================================
        Write-Host ""
        Write-Host "Setting up Startup Folder shortcut..." -ForegroundColor Yellow
        
        $startupFolder = [Environment]::GetFolderPath('Startup')
        $shortcutPath = Join-Path $startupFolder "SmartWish Print Agent.lnk"
        
        # Create shortcut
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
        $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Minimized -File `"$printAgentScript`""
        $shortcut.WorkingDirectory = $scriptDir
        $shortcut.Description = "SmartWish Local Print Agent"
        $shortcut.WindowStyle = 7  # Minimized
        $shortcut.Save()
        
        Write-Host ""
        Write-Host "SUCCESS: Startup shortcut created!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "The print agent will start automatically when you log in." -ForegroundColor Green
        Write-Host "It will run minimized in the background." -ForegroundColor Green
        Write-Host ""
        Write-Host "To remove: Delete the shortcut from your Startup folder" -ForegroundColor Yellow
        Write-Host "  Path: $startupFolder" -ForegroundColor White
    }
    
    "2" {
        # =============================================
        # OPTION 2: Task Scheduler (System Startup)
        # =============================================
        
        # Check if running as Administrator
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Write-Host ""
            Write-Host "ERROR: Task Scheduler requires Administrator!" -ForegroundColor Red
            Write-Host "Right-click this script and select 'Run as Administrator'" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Or use Option 1 (Startup Folder) which doesn't require Admin." -ForegroundColor Cyan
            pause
            exit 1
        }
        
        $taskName = "SmartWishPrintAgent"
        $taskDescription = "Starts SmartWish local print agent on system startup"
        
        Write-Host ""
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
            -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$printAgentScript`"" `
            -WorkingDirectory $scriptDir
        
        # Create the trigger (on user logon - more reliable than startup)
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        
        # Create settings
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RestartCount 3 `
            -RestartInterval (New-TimeSpan -Minutes 1)
        
        # Register the task (current user)
        try {
            Register-ScheduledTask `
                -TaskName $taskName `
                -Action $action `
                -Trigger $trigger `
                -Settings $settings `
                -Description $taskDescription `
                -Force | Out-Null
            
            Write-Host ""
            Write-Host "SUCCESS: Task Scheduler task created!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Task Details:" -ForegroundColor Cyan
            Write-Host "  Name: $taskName"
            Write-Host "  Trigger: At user logon"
            Write-Host "  Script: $printAgentScript"
            Write-Host ""
            Write-Host "The print agent will now start automatically when you log in." -ForegroundColor Green
            Write-Host ""
            Write-Host "To start now: Start-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor Yellow
            Write-Host "To remove: Unregister-ScheduledTask -TaskName `"$taskName`" -Confirm:`$false" -ForegroundColor Yellow
            
        } catch {
            Write-Host ""
            Write-Host "ERROR: Failed to create task" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
    
    "3" {
        # =============================================
        # OPTION 3: Remove Auto-Start
        # =============================================
        Write-Host ""
        Write-Host "Removing auto-start configurations..." -ForegroundColor Yellow
        
        # Remove Startup folder shortcut
        $startupFolder = [Environment]::GetFolderPath('Startup')
        $shortcutPath = Join-Path $startupFolder "SmartWish Print Agent.lnk"
        if (Test-Path $shortcutPath) {
            Remove-Item $shortcutPath -Force
            Write-Host "  Removed Startup folder shortcut" -ForegroundColor Green
        } else {
            Write-Host "  No Startup folder shortcut found" -ForegroundColor Gray
        }
        
        # Remove Task Scheduler task
        $taskName = "SmartWishPrintAgent"
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "  Removed Task Scheduler task" -ForegroundColor Green
        } else {
            Write-Host "  No Task Scheduler task found" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "Auto-start has been disabled." -ForegroundColor Green
    }
    
    "4" {
        Write-Host "Exiting..." -ForegroundColor Gray
        exit 0
    }
    
    default {
        Write-Host "Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

