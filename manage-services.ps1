# Smartwish Service Manager
# Script to manage backend and frontend services

$backendPath = "D:\Projects\Smartwish\Code\Smartwish\smartwish-backend\backend"
$frontendPath = "D:\Projects\Smartwish\Code\Smartwish\smartwish-frontend"
$backendPort = 3000
$frontendPort = 3001

# Track PowerShell processes we create
$script:backendPowerShellProcess = $null
$script:frontendPowerShellProcess = $null

function Kill-AllCmdTerminals {
    Write-Host "Killing all CMD and PowerShell terminals..." -ForegroundColor Yellow
    
    $killedCount = 0
    $currentPid = $pid
    
    # Function to forcefully kill a process with multiple methods
    function Kill-ProcessForcefully {
        param([int]$ProcessId, [string]$ProcessName)
        
        $killed = $false
        
        # Method 1: Try taskkill with /T (kill process tree) and /F (force)
        try {
            $null = & taskkill /F /T /PID $ProcessId 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Killed $ProcessName (PID: $ProcessId) using taskkill /T /F" -ForegroundColor Green
                $killed = $true
            }
        } catch {
            # Continue to next method
        }
        
        # Method 2: Try Stop-Process with Force
        if (-not $killed) {
            try {
                Stop-Process -Id $ProcessId -Force -ErrorAction Stop
                Write-Host "  [OK] Killed $ProcessName (PID: $ProcessId) using Stop-Process" -ForegroundColor Green
                $killed = $true
            } catch {
                # Continue to next method
            }
        }
        
        # Method 3: Try WMI Terminate
        if (-not $killed) {
            try {
                $proc = Get-WmiObject Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
                if ($proc) {
                    $proc.Terminate()
                    Start-Sleep -Milliseconds 500
                    if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
                        Write-Host "  [OK] Killed $ProcessName (PID: $ProcessId) using WMI" -ForegroundColor Green
                        $killed = $true
                    }
                }
            } catch {
                # Continue
            }
        }
        
        if (-not $killed) {
            Write-Host "  [FAIL] Failed to kill $ProcessName (PID: $ProcessId)" -ForegroundColor Red
        }
        
        return $killed
    }
    
    # Kill all cmd.exe processes
    try {
        $allCmd = @(Get-Process cmd -ErrorAction SilentlyContinue)
        
        if ($allCmd.Count -gt 0) {
            Write-Host "Found $($allCmd.Count) CMD terminal(s)..." -ForegroundColor Yellow
            foreach ($cmdProcess in $allCmd) {
                if (Kill-ProcessForcefully -ProcessId $cmdProcess.Id -ProcessName "CMD") {
                    $killedCount++
                }
            }
        }
    } catch {
        Write-Host "Error finding CMD terminals: $_" -ForegroundColor Yellow
    }
    
    # Kill all PowerShell processes except the current one
    try {
        $allPowerShell = @(Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPid })
        
        if ($allPowerShell.Count -gt 0) {
            Write-Host "Found $($allPowerShell.Count) PowerShell terminal(s)..." -ForegroundColor Yellow
            foreach ($psProcess in $allPowerShell) {
                if (Kill-ProcessForcefully -ProcessId $psProcess.Id -ProcessName "PowerShell") {
                    $killedCount++
                }
            }
        }
    } catch {
        Write-Host "Error finding PowerShell terminals: $_" -ForegroundColor Yellow
    }
    
    # Also kill pwsh (PowerShell Core) if present
    try {
        $allPwsh = @(Get-Process pwsh -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPid })
        
        if ($allPwsh.Count -gt 0) {
            Write-Host "Found $($allPwsh.Count) PowerShell Core terminal(s)..." -ForegroundColor Yellow
            foreach ($pwshProcess in $allPwsh) {
                if (Kill-ProcessForcefully -ProcessId $pwshProcess.Id -ProcessName "PowerShell Core") {
                    $killedCount++
                }
            }
        }
    } catch {
        # Ignore if pwsh doesn't exist
    }
    
    # Wait a moment for processes to fully terminate
    Start-Sleep -Milliseconds 500
    
    if ($killedCount -eq 0) {
        Write-Host "No terminal windows found to kill." -ForegroundColor Green
    } else {
        Write-Host "Successfully killed $killedCount terminal window(s)." -ForegroundColor Green
    }
}

function Kill-PowerShellWindows {
    Write-Host "Closing PowerShell windows for services..." -ForegroundColor Yellow
    
    # Kill tracked backend PowerShell window
    if ($script:backendPowerShellProcess -and !$script:backendPowerShellProcess.HasExited) {
        try {
            Write-Host "Closing backend PowerShell window (PID: $($script:backendPowerShellProcess.Id))" -ForegroundColor Red
            Stop-Process -Id $script:backendPowerShellProcess.Id -Force -ErrorAction Stop
            Write-Host "Backend PowerShell window closed." -ForegroundColor Green
        } catch {
            Write-Host "Could not close backend PowerShell window: $_" -ForegroundColor Red
        }
        $script:backendPowerShellProcess = $null
    }
    
    # Kill tracked frontend PowerShell window
    if ($script:frontendPowerShellProcess -and !$script:frontendPowerShellProcess.HasExited) {
        try {
            Write-Host "Closing frontend PowerShell window (PID: $($script:frontendPowerShellProcess.Id))" -ForegroundColor Red
            Stop-Process -Id $script:frontendPowerShellProcess.Id -Force -ErrorAction Stop
            Write-Host "Frontend PowerShell window closed." -ForegroundColor Green
        } catch {
            Write-Host "Could not close frontend PowerShell window: $_" -ForegroundColor Red
        }
        $script:frontendPowerShellProcess = $null
    }
    
    # Also find and kill any PowerShell processes running npm in those directories
    try {
        $currentPid = $pid
        $allPowerShell = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPid }
        
        foreach ($psProcess in $allPowerShell) {
            try {
                $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($psProcess.Id)").CommandLine
                if ($commandLine) {
                    # Check if it's running npm in our directories
                    if (($commandLine -like "*$backendPath*" -and $commandLine -like "*npm*") -or
                        ($commandLine -like "*$frontendPath*" -and $commandLine -like "*npm*")) {
                        Write-Host "Found and closing PowerShell window running npm (PID: $($psProcess.Id))" -ForegroundColor Red
                        Stop-Process -Id $psProcess.Id -Force -ErrorAction Stop
                        Write-Host "PowerShell window closed." -ForegroundColor Green
                    }
                }
            } catch {
                # Ignore errors when checking process details
            }
        }
    } catch {
        Write-Host "Error finding PowerShell windows: $_" -ForegroundColor Yellow
    }
}

function Kill-PortProcess {
    param([int]$Port)
    
    Write-Host "Checking for processes on port $Port..." -ForegroundColor Yellow
    
    try {
        # Find processes using the port
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        
        if ($connections) {
            $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            
            foreach ($processId in $processIds) {
                try {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "Killing process: $($process.ProcessName) (PID: $processId) on port $Port" -ForegroundColor Red
                        Stop-Process -Id $processId -Force -ErrorAction Stop
                        Write-Host "Process killed successfully." -ForegroundColor Green
                    }
                } catch {
                    Write-Host "Could not kill process $processId : $_" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "No processes found on port $Port" -ForegroundColor Green
        }
    } catch {
        Write-Host "Error checking port $Port : $_" -ForegroundColor Red
    }
}

function Start-Backend {
    Write-Host "`nStarting Backend..." -ForegroundColor Cyan
    Write-Host "Path: $backendPath" -ForegroundColor Gray
    Write-Host "Command: npm run start:dev`n" -ForegroundColor Gray
    
    if (Test-Path $backendPath) {
        $backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run start:dev" -PassThru
        $script:backendPowerShellProcess = $backendJob
        Write-Host "Backend started in new window (PID: $($backendJob.Id))" -ForegroundColor Green
        return $backendJob
    } else {
        Write-Host "Backend path does not exist: $backendPath" -ForegroundColor Red
        return $null
    }
}

function Start-Frontend {
    Write-Host "`nStarting Frontend..." -ForegroundColor Cyan
    Write-Host "Path: $frontendPath" -ForegroundColor Gray
    Write-Host "Command: npm run dev`n" -ForegroundColor Gray
    
    if (Test-Path $frontendPath) {
        $frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -PassThru
        $script:frontendPowerShellProcess = $frontendJob
        Write-Host "Frontend started in new window (PID: $($frontendJob.Id))" -ForegroundColor Green
        return $frontendJob
    } else {
        Write-Host "Frontend path does not exist: $frontendPath" -ForegroundColor Red
        return $null
    }
}

function Kill-Services {
    Write-Host "`n=== Killing Services ===" -ForegroundColor Yellow
    
    # First kill processes on ports 3000 and 3001
    Kill-PortProcess -Port $backendPort
    Kill-PortProcess -Port $frontendPort
    
    # Then kill all cmd terminals
    Kill-AllCmdTerminals
    
    # Finally kill PowerShell windows
    Kill-PowerShellWindows
    
    Write-Host "`nDone killing services.`n" -ForegroundColor Green
}

function Start-Services {
    Write-Host "`n=== Starting Services ===" -ForegroundColor Yellow
    Start-Backend
    Start-Sleep -Seconds 2
    Start-Frontend
    Write-Host "`nDone starting services.`n" -ForegroundColor Green
}

function Restart-Services {
    Write-Host "`n=== Restarting Services ===" -ForegroundColor Yellow
    Kill-Services
    Write-Host "Waiting 3 seconds before starting services..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
    Start-Services
}

# Main Menu
function Show-Menu {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   Smartwish Service Manager" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "1. Kill both services (ports $backendPort and $frontendPort)" -ForegroundColor White
    Write-Host "2. Start both services" -ForegroundColor White
    Write-Host "3. Restart both services (kill then start)" -ForegroundColor White
    Write-Host "4. Exit`n" -ForegroundColor White
}

# Main loop
while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option (1-4)"
    
    switch ($choice) {
        "1" {
            Kill-Services
        }
        "2" {
            Start-Services
        }
        "3" {
            Restart-Services
        }
        "4" {
            Write-Host "`nExiting..." -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "`nInvalid option. Please select 1-4.`n" -ForegroundColor Red
        }
    }
    
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    Clear-Host
}
