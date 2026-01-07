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

# Method 1: Try using SumatraPDF with command-line tray selection
$sumatraPaths = @(
    "C:\Users\makar\AppData\Local\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
)

$sumatraPath = $null
foreach ($path in $sumatraPaths) {
    if (Test-Path $path) {
        $sumatraPath = $path
        break
    }
}

if ($sumatraPath) {
    Write-Host "   Using SumatraPDF: $sumatraPath"
    
    # Build print settings
    $settings = @()
    
    if ($isSticker) {
        $settings += "simplex"
    } else {
        $settings += "duplexshort"
    }
    
    $settings += "color"
    $settings += "noscale"
    
    # HP tray names - try different formats
    if ($TrayNumber -gt 0) {
        # HP OfficeJet Pro uses "Tray 1", "Tray 2"
        $settings += "bin=Tray $TrayNumber"
    }
    
    $settingsStr = $settings -join ","
    
    Write-Host "   Print settings: $settingsStr"
    
    try {
        $process = Start-Process -FilePath $sumatraPath -ArgumentList @(
            "-print-to", "`"$PrinterName`"",
            "-print-settings", "`"$settingsStr`"",
            "-silent",
            "`"$PdfPath`""
        ) -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Print job sent successfully via SumatraPDF!"
            exit 0
        } else {
            Write-Host "⚠️ SumatraPDF exited with code: $($process.ExitCode)"
        }
    } catch {
        Write-Host "⚠️ SumatraPDF error: $_"
    }
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

# Method 3: Use Windows built-in print command
Write-Host "   Falling back to Windows print command..."

try {
    # Use Start-Process with the default PDF handler
    Start-Process -FilePath $PdfPath -Verb PrintTo -ArgumentList $PrinterName -Wait
    Write-Host "✅ Print job sent via Windows default handler!"
    exit 0
} catch {
    Write-Host "⚠️ Windows print error: $_"
}

# Method 4: Last resort - PowerShell Out-Printer (text only, won't work for PDFs)
Write-Host "❌ All print methods failed. Please print manually."
Write-Host ""
Write-Host "To set tray manually:"
Write-Host "1. Open Control Panel → Devices and Printers"
Write-Host "2. Right-click '$PrinterName'"
Write-Host "3. Select 'Printing Preferences'"
Write-Host "4. Set 'Paper Source' to 'Tray $TrayNumber'"
Write-Host "5. Click OK and try printing again"

exit 1
