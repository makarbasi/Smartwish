# --- CONFIGURATION ---
$PrinterIP = "192.168.1.108"
$Community = "public"
# ---------------------

function Get-SnmpValue {
    param (
        [string]$IP,
        [string]$OID,
        [string]$Community = "public"
    )

    # Build SNMP Get-Request Packet (simplified for common OIDs)
    $oidParts = $OID.Split('.') | Where-Object { $_ -ne "" }
    $oidBytes = foreach ($part in $oidParts) { [byte][int]$part }
    
    # Simple SNMP v2c GetRequest packet header
    $packet = [System.Collections.Generic.List[byte]]::new()
    $packet.AddRange(@(0x30, 0x00)) # Sequence + Length (placeholder)
    $packet.AddRange(@(0x02, 0x01, 0x01)) # Version: v2c
    $packet.AddRange(@(0x04, $Community.Length)) # Community string tag + length
    $packet.AddRange([System.Text.Encoding]::ASCII.GetBytes($Community))
    $packet.AddRange(@(0xa0, 0x00)) # PDU type: GetRequest + Length (placeholder)
    $packet.AddRange(@(0x02, 0x04, 0x01, 0x02, 0x03, 0x04)) # Request ID
    $packet.AddRange(@(0x02, 0x01, 0x00)) # Error status: 0
    $packet.AddRange(@(0x02, 0x01, 0x00)) # Error index: 0
    $packet.AddRange(@(0x30, 0x00)) # Varbind list + Length (placeholder)
    $packet.AddRange(@(0x30, 0x00)) # Varbind + Length (placeholder)
    $packet.AddRange(@(0x06, $oidBytes.Count)) # Object ID tag + length
    $packet.AddRange($oidBytes)
    $packet.AddRange(@(0x05, 0x00)) # Null value

    # Update lengths in packet
    $packet[25] = $oidBytes.Count + 4
    $packet[23] = $packet[25] + 2
    $packet[9] = $packet[23] + 13
    $packet[1] = $packet[9] + 8 + $Community.Length

    $udp = New-Object System.Net.Sockets.UdpClient($IP, 161)
    $udp.Client.ReceiveTimeout = 2000
    $bytesSent = $udp.Send($packet.ToArray(), $packet.Count)
    
    try {
        $remoteIp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $response = $udp.Receive([ref]$remoteIp)
        $udp.Close()
        
        # Extract the value from the response (very basic parsing)
        $valType = $response[-3] # The byte indicating if it's an Integer (0x02) or String (0x04)
        $val = $response[-1]
        
        # Handle larger integers (2-byte results like 100%)
        if ($response[-2] -ne 0x00 -and $valType -eq 0x02 -and $response[-2] -lt 128) {
            $val = ($response[-2] * 256) + $response[-1]
        }
        
        return $val
    } catch {
        $udp.Close()
        return $null
    }
}

Write-Host "`nQuerying HP OfficeJet via SNMP at $PrinterIP..." -ForegroundColor Cyan
Write-Host "------------------------------------------------"

# OID Constants for HP Printers
$OIDs = @{
    "Status"    = "1.3.6.1.2.1.25.3.5.1.1.1"
    "BlackInk"  = "1.3.6.1.2.1.43.11.1.1.9.1.1"
    "YellowInk" = "1.3.6.1.2.1.43.11.1.1.9.1.2"
    "CyanInk"   = "1.3.6.1.2.1.43.11.1.1.9.1.3"
    "MagInk"    = "1.3.6.1.2.1.43.11.1.1.9.1.4"
    "Tray1"     = "1.3.6.1.2.1.43.8.2.1.10.1.1"
}

# 1. Check Overall Status
$rawStatus = Get-SnmpValue $PrinterIP $OIDs.Status
$statusText = switch($rawStatus) {
    3 { "Idle (Ready)" }
    4 { "Printing..." }
    5 { "Warmup / Busy" }
    default { "Unknown ($rawStatus)" }
}
Write-Host "Printer Status : " -NoNewline
Write-Host $statusText -ForegroundColor Yellow

# 2. Check Ink Levels
Write-Host "`nInk Levels:" -ForegroundColor Cyan
foreach ($color in "BlackInk","CyanInk","MagInk","YellowInk") {
    $level = Get-SnmpValue $PrinterIP $OIDs.$color
    if ($null -ne $level) {
        # HP returns -3 for "OK", or 0-100 for percentage
        $display = if ($level -eq 253) { "OK" } else { "$level%" }
        Write-Host " - $color : " -NoNewline
        Write-Host $display -ForegroundColor Green
    }
}

# 3. Check Tray 1
$tray = Get-SnmpValue $PrinterIP $OIDs.Tray1
$trayText = switch($tray) {
    -3 { "Paper OK" }
    -2 { "Unknown/Full" }
    0  { "OUT OF PAPER" }
    default { "Level: $tray" }
}
Write-Host "`nTray Status:" -ForegroundColor Cyan
Write-Host " - Main Tray   : $trayText"

Write-Host "------------------------------------------------`n"