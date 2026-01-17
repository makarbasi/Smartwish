
# PDF Printing Script
$printerName = "HP OfficeJet Pro 9135 Plain"
$pdfPath = "D:\\Projects\\Smartwish\\Code\\Smartwish\\smartwish-backend\\print-agent-deployment\\temp-print-jobs\\job_1768658580892_1hpg2o5w6\\greeting-card.pdf"
$printSettings = "duplexshort"

# SumatraPDF paths
$sumatraPaths = @(
  "$env:LOCALAPPDATA\SumatraPDF\SumatraPDF.exe",
  "C:\Program Files\SumatraPDF\SumatraPDF.exe",
  "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
)

$sumatraPath = $null
foreach ($p in $sumatraPaths) {
  if (Test-Path $p) {
    $sumatraPath = $p
    break
  }
}

if ($sumatraPath) {
  Write-Host "Using SumatraPDF to print..."
  # Build print arguments with optional print settings (duplex mode)
  if ($printSettings) {
    $printArgs = "-print-to `"$printerName`" -print-settings `"$printSettings`" `"$pdfPath`""
    Write-Host "Print mode: $printSettings"
  } else {
    $printArgs = "-print-to `"$printerName`" `"$pdfPath`""
    Write-Host "Print mode: simplex (single-sided)"
  }
  Start-Process -FilePath $sumatraPath -ArgumentList $printArgs -Wait -WindowStyle Hidden
  Write-Host "Print job sent via SumatraPDF"
  exit 0
}

# Fallback: Adobe Reader (does not support duplex via command line)
$adobePaths = @(
  "$env:ProgramFiles\Adobe\Acrobat DC\Acrobat\Acrobat.exe",
  "${env:ProgramFiles(x86)}\Adobe\Acrobat DC\Acrobat\Acrobat.exe",
  "$env:ProgramFiles\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe",
  "${env:ProgramFiles(x86)}\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe"
)

foreach ($p in $adobePaths) {
  if (Test-Path $p) {
    Write-Host "Using Adobe Reader to print (duplex settings not supported, using printer defaults)..."
    $printArgs = "/t `"$pdfPath`" `"$printerName`""
    Start-Process -FilePath $p -ArgumentList $printArgs -Wait -WindowStyle Hidden
    Write-Host "Print job sent via Adobe Reader"
    exit 0
  }
}

# Fallback: Windows default handler (duplex settings not supported)
Write-Host "Using Windows default PDF handler (duplex settings not supported)..."
try {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $pdfPath
  $psi.Verb = "printto"
  $psi.Arguments = "`"$printerName`""
  $psi.CreateNoWindow = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $process = [System.Diagnostics.Process]::Start($psi)
  $process.WaitForExit(10000)
  Write-Host "Print job sent via default handler"
  exit 0
} catch {
  Write-Host "Error: $_"
  exit 1
}
