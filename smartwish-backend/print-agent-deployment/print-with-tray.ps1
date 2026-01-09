# print-with-tray.ps1
# Print a PDF to a specific printer and tray on Windows
# Usage: powershell -ExecutionPolicy Bypass -File print-with-tray.ps1 -PdfPath "path.pdf" -PrinterName "HP..." -TrayNumber 1

param(
    [Parameter(Mandatory=$true)]
    [string]$PdfPath,
    
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    
    [Parameter(Mandatory=$false)]
    [int]$TrayNumber = 0,
    
    [Parameter(Mandatory=$false)]
    [string]$PaperType = "greeting-card"
)

Write-Host "🖨️ Print with Tray Selection Script"
Write-Host "   PDF: $PdfPath"
Write-Host "   Printer: $PrinterName"
Write-Host "   Tray: $TrayNumber"
Write-Host "   Paper Type: $PaperType"

# Check if PDF exists
if (-not (Test-Path $PdfPath)) {
    Write-Error "PDF file not found: $PdfPath"
    exit 1
}

# Determine duplex setting based on paper type
$isSticker = $PaperType -eq "sticker"
$duplexMode = if ($isSticker) { "OneSided" } else { "TwoSidedShortEdge" }

Write-Host "   Duplex: $duplexMode"

# METHOD 0: Set printer tray via PowerShell PrintConfiguration (most reliable)
if ($TrayNumber -gt 0) {
    Write-Host ""
    Write-Host "   Setting printer tray via Set-PrintConfiguration..."
    try {
        # First, try using Set-PrintConfiguration with InputBin
        $trayNames = @(
            "Tray $TrayNumber",
            "Tray$TrayNumber",
            "tray-$TrayNumber",
            "$TrayNumber"
        )
        
        $traySet = $false
        foreach ($trayName in $trayNames) {
            try {
                Write-Host "   Trying tray format: $trayName"
                Set-PrintConfiguration -PrinterName $PrinterName -InputBin $trayName -ErrorAction Stop
                Write-Host "   ✅ Set tray to: $trayName"
                $traySet = $true
                break
            } catch {
                Write-Host "   ⚠️  Tray format '$trayName' failed: $_"
            }
        }
        
        if (-not $traySet) {
            Write-Host "   ⚠️  Set-PrintConfiguration failed, trying WMI..."
            
            # Fallback to WMI
            $printer = Get-WmiObject -Class Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction Stop
            if (-not $printer) {
                Write-Host "   ❌ Printer not found: $PrinterName"
                throw "Printer not found"
            }
            
            Write-Host "   ✅ Printer found: $($printer.Name)"
            
            # Get printer configuration
            $config = Get-WmiObject -Class Win32_PrinterConfiguration -Filter "Name='$PrinterName'" -ErrorAction Stop
            if (-not $config) {
                Write-Host "   ❌ Could not get printer configuration"
                throw "Could not get printer configuration"
            }
            
            $traySet = $false
            foreach ($trayName in $trayNames) {
                try {
                    Write-Host "   Trying WMI tray format: $trayName"
                    $config.PaperSource = $trayName
                    $result = $config.Put()
                    if ($result.ReturnValue -eq 0) {
                        Write-Host "   ✅ Set tray via WMI to: $trayName (ReturnValue: $($result.ReturnValue))"
                        $traySet = $true
                        break
                    } else {
                        Write-Host "   ⚠️  WMI tray format '$trayName' failed (ReturnValue: $($result.ReturnValue))"
                    }
                } catch {
                    Write-Host "   ⚠️  WMI tray format '$trayName' error: $_"
                }
            }
        }
        
        if (-not $traySet) {
            Write-Host "   ❌ Could not set tray - all methods and formats failed"
            throw "Could not set tray"
        }
        
        # Verify the setting was applied
        try {
            $verifyConfig = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
            Write-Host "   📋 Verified InputBin setting: $($verifyConfig.InputBin)"
        } catch {
            $verifyConfig = Get-WmiObject -Class Win32_PrinterConfiguration -Filter "Name='$PrinterName'" -ErrorAction Stop
            Write-Host "   📋 Verified PaperSource setting: $($verifyConfig.PaperSource)"
        }
        
    } catch {
        Write-Host "   ❌ Tray setting failed: $_"
        throw "Failed to set tray: $_"
    }
}

# Method 1: Print using Windows Print API with tray selection
Write-Host "   Printing via Windows Print API..."
try {
    # Use Start-Process with PrintTo verb - this respects printer tray settings
    $process = Start-Process -FilePath $PdfPath -Verb PrintTo -ArgumentList "`"$PrinterName`"" -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0 -or $process.ExitCode -eq $null) {
        Write-Host "✅ Print job sent successfully via Windows Print API!"
        exit 0
    } else {
        Write-Host "⚠️ Print command exited with code: $($process.ExitCode)"
    }
} catch {
    Write-Host "⚠️ Windows Print API error: $_"
}

# Method 2: Try using Adobe Reader (if installed)
$adobePaths = @(
    "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe",
    "C:\Program Files (x86)\Adobe\Acrobat DC\Acrobat\Acrobat.exe",
    "C:\Program Files\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe",
    "C:\Program Files (x86)\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe"
)

$adobePath = $null
foreach ($path in $adobePaths) {
    if (Test-Path $path) {
        $adobePath = $path
        break
    }
}

if ($adobePath) {
    Write-Host "   Trying Adobe Reader: $adobePath"
    try {
        # Adobe Reader command line: /t <filepath> <printername> <drivername> <portname>
        $process = Start-Process -FilePath $adobePath -ArgumentList "/t `"$PdfPath`" `"$PrinterName`"" -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Print job sent via Adobe Reader!"
            exit 0
        }
    } catch {
        Write-Host "⚠️ Adobe Reader error: $_"
    }
}

# Method 3: Use default PDF handler
Write-Host "   Trying default PDF handler..."
try {
    Start-Process -FilePath $PdfPath -Verb Print -Wait
    Write-Host "✅ Print job sent via default PDF handler!"
    exit 0
} catch {
    Write-Host "⚠️ Default handler error: $_"
}

# All methods failed
Write-Host "❌ All print methods failed. Please print manually."
Write-Host ""
Write-Host "To set tray manually:"
Write-Host "1. Open Control Panel → Devices and Printers"
Write-Host "2. Right-click '$PrinterName'"
Write-Host "3. Select 'Printing Preferences'"
Write-Host "4. Set 'Paper Source' to 'Tray $TrayNumber'"
Write-Host "5. Click OK and try printing again"

exit 1
