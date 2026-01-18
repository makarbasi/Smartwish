# Smartwish Service Manager
# Script to manage backend and frontend services

$backendPath = "D:\Projects\Smartwish\Code\Smartwish\smartwish-backend\backend"
$frontendPath = "D:\Projects\Smartwish\Code\Smartwish\smartwish-frontend"
$backendPort = 3000
$frontendPort = 3001

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
        Write-Host "Frontend started in new window (PID: $($frontendJob.Id))" -ForegroundColor Green
        return $frontendJob
    } else {
        Write-Host "Frontend path does not exist: $frontendPath" -ForegroundColor Red
        return $null
    }
}

function Kill-Services {
    Write-Host "`n=== Killing Services ===" -ForegroundColor Yellow
    Kill-PortProcess -Port $backendPort
    Kill-PortProcess -Port $frontendPort
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
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Clear-Host
}
