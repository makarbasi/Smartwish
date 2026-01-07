# list-printer-trays.ps1
# List all available trays/paper sources for a printer
# Usage: powershell -ExecutionPolicy Bypass -File list-printer-trays.ps1 -PrinterName "HP..."

param(
    [Parameter(Mandatory=$false)]
    [string]$PrinterName = ""
)

Write-Host "🖨️ Printer Tray Discovery Tool"
Write-Host "==============================="
Write-Host ""

# List all printers if no printer specified
if (-not $PrinterName) {
    Write-Host "Available Printers:"
    Write-Host "-------------------"
    Get-Printer | ForEach-Object {
        Write-Host "  - $($_.Name)"
    }
    Write-Host ""
    Write-Host "Run with -PrinterName to see tray details:"
    Write-Host '  powershell -File list-printer-trays.ps1 -PrinterName "HP OfficeJet Pro 9135e"'
    exit 0
}

Write-Host "Printer: $PrinterName"
Write-Host ""

# Get printer info
try {
    $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
    Write-Host "Printer Found: $($printer.Name)"
    Write-Host "  Driver: $($printer.DriverName)"
    Write-Host "  Port: $($printer.PortName)"
    Write-Host "  Status: $($printer.PrinterStatus)"
    Write-Host ""
} catch {
    Write-Host "❌ Printer not found: $PrinterName"
    exit 1
}

# Get printer configuration
Write-Host "Printer Configuration:"
Write-Host "----------------------"
try {
    $config = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
    Write-Host "  Color: $($config.Color)"
    Write-Host "  Duplex: $($config.DuplexingMode)"
    Write-Host "  Paper Size: $($config.PaperSize)"
    Write-Host ""
} catch {
    Write-Host "  (Unable to get configuration)"
}

# Get WMI printer info for more details
Write-Host "Paper Sources (via WMI):"
Write-Host "------------------------"
try {
    $wmiPrinter = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='$PrinterName'" -ErrorAction Stop
    
    if ($wmiPrinter) {
        # Paper sources are stored as an array
        $paperSources = $wmiPrinter.PaperSizesSupported
        if ($paperSources) {
            Write-Host "  Supported Paper Sizes: $($paperSources -join ', ')"
        }
        
        Write-Host "  Default Paper Type: $($wmiPrinter.DefaultPaperType)"
        Write-Host "  Capabilities: $($wmiPrinter.Capabilities -join ', ')"
    }
} catch {
    Write-Host "  (Unable to get WMI info)"
}

Write-Host ""
Write-Host "Common HP Tray Names for SumatraPDF:"
Write-Host "------------------------------------"
Write-Host "  bin=Tray 1    (Upper tray - usually sticker paper)"
Write-Host "  bin=Tray 2    (Main tray - usually card stock)"
Write-Host "  bin=Auto      (Automatic selection)"
Write-Host ""

Write-Host "Test Commands:"
Write-Host "--------------"
Write-Host "To test Tray 1:"
Write-Host '  SumatraPDF.exe -print-to "' + $PrinterName + '" -print-settings "simplex,color,bin=Tray 1" -silent "test.pdf"'
Write-Host ""
Write-Host "To test Tray 2:"
Write-Host '  SumatraPDF.exe -print-to "' + $PrinterName + '" -print-settings "duplexshort,color,bin=Tray 2" -silent "test.pdf"'
Write-Host ""

# Check if SumatraPDF is installed
$sumatraPaths = @(
    "$env:LOCALAPPDATA\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
)

$sumatraFound = $false
foreach ($path in $sumatraPaths) {
    if (Test-Path $path) {
        Write-Host "✅ SumatraPDF found at: $path"
        $sumatraFound = $true
        break
    }
}

if (-not $sumatraFound) {
    Write-Host "❌ SumatraPDF NOT FOUND!"
    Write-Host "   Install from: https://www.sumatrapdfreader.org/download-free-pdf-viewer"
    Write-Host "   Tray selection requires SumatraPDF to work reliably."
}
