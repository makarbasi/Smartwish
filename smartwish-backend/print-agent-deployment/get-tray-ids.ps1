# get-tray-ids.ps1
# Get actual tray IDs and names for a printer
# Usage: powershell -ExecutionPolicy Bypass -File get-tray-ids.ps1 -PrinterName "HP..."

param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName
)

Write-Host "🔍 Discovering Tray IDs for: $PrinterName"
Write-Host ""

try {
    # Get printer using WMI
    $printer = Get-WmiObject -Class Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction Stop
    if (-not $printer) {
        Write-Host "❌ Printer not found: $PrinterName"
        exit 1
    }
    
    Write-Host "Printer: $($printer.Name)"
    Write-Host "Driver: $($printer.DriverName)"
    Write-Host ""
    
    # Try to get printer capabilities
    Write-Host "Attempting to get tray information..."
    Write-Host ""
    
    # Method 1: Try Get-PrintConfiguration
    try {
        $config = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
        Write-Host "Current InputBin: $($config.InputBin)"
        Write-Host ""
    } catch {
        Write-Host "Could not get InputBin via Get-PrintConfiguration"
    }
    
    # Method 2: Try WMI PrinterConfiguration
    try {
        $wmiConfig = Get-WmiObject -Class Win32_PrinterConfiguration -Filter "Name='$PrinterName'" -ErrorAction Stop
        Write-Host "Current PaperSource (WMI): $($wmiConfig.PaperSource)"
        Write-Host ""
    } catch {
        Write-Host "Could not get PaperSource via WMI"
    }
    
    # Method 3: Try to enumerate printer properties
    Write-Host "Trying to enumerate printer properties..."
    try {
        $printerProps = $printer | Get-Member -MemberType Property
        Write-Host "Available properties:"
        $printerProps | Where-Object { $_.Name -like "*Tray*" -or $_.Name -like "*Paper*" -or $_.Name -like "*Source*" -or $_.Name -like "*Bin*" } | ForEach-Object {
            $propName = $_.Name
            $propValue = $printer.$propName
            Write-Host "  $propName = $propValue"
        }
    } catch {
        Write-Host "Could not enumerate properties"
    }
    
    Write-Host ""
    Write-Host "Try manually checking printer properties:"
    Write-Host "   1. Open Control Panel -> Devices and Printers"
    Write-Host "   2. Right-click '$PrinterName' -> Printing Preferences"
    Write-Host "   3. Check the exact tray names shown in the Paper Source dropdown"
    
} catch {
    Write-Host "❌ Error: $_"
    exit 1
}

