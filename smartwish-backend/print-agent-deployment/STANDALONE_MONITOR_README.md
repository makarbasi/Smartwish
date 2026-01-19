# Standalone Printer SNMP Monitor

A simple standalone script to monitor printer status via SNMP and report errors in real-time.

## Prerequisites

1. **Node.js** (v14 or higher)
2. **net-snmp** package

## Installation

```bash
cd smartwish-backend/print-agent-deployment
npm install net-snmp
```

Or if you're in the project root:
```bash
cd smartwish-backend/print-agent-deployment
npm install
```

## Usage

```bash
node standalone-printer-monitor.js <PRINTER_IP> [COMMUNITY] [INTERVAL_MS]
```

### Parameters

- **PRINTER_IP** (required): The IP address of your printer
- **COMMUNITY** (optional): SNMP community string (default: `public`)
- **INTERVAL_MS** (optional): Polling interval in milliseconds (default: `10000` = 10 seconds)

### Examples

```bash
# Basic usage with default settings
node standalone-printer-monitor.js 192.168.1.100

# With custom SNMP community
node standalone-printer-monitor.js 192.168.1.100 private

# With custom polling interval (5 seconds)
node standalone-printer-monitor.js 192.168.1.100 public 5000
```

## What It Monitors

### Initial Status Queries
- Printer state (idle, printing, warmup, etc.)
- Device status
- Error state bitmap

### Table Walks (Detailed Info)
- **Ink/Toner Levels**: All cartridges with levels and descriptions
- **Paper Trays**: All input trays with levels, capacity, and status
- **Active Alerts**: All current alerts (paper low, ink empty, etc.)

## Features

- ✅ Real-time monitoring with configurable polling interval
- ✅ Detects new errors/alerts as they occur
- ✅ Reports when alerts are resolved
- ✅ Color-coded status indicators (🟢 OK, 🟡 Low, 🔴 Empty/Critical)
- ✅ Detailed information about ink, paper, and alerts
- ✅ Graceful shutdown with Ctrl+C

## Output Example

```
🖨️  Starting Printer Monitor
   Printer IP: 192.168.1.100
   SNMP Community: public
   Poll Interval: 10000ms

[10:30:45 AM] Checking printer status...
  📊 Printer State: idle
  📊 Device Status: 3
  📊 Error State: 0x0

  🖨️  Ink/Toner Levels:
    🟢 BLACK: 85% (HP 305 Black)
    🟢 CYAN: 78% (HP 305 Cyan)
    🟢 MAGENTA: 82% (HP 305 Magenta)
    🟢 YELLOW: 75% (HP 305 Yellow)

  📄 Paper Trays:
    🟢 tray1: 100% (Tray 1)
    🟢 tray2: 95% (Tray 2)

  ⚠️  Active Alerts:
    ✅ No active alerts

[10:30:55 AM] Checking printer status...
  📊 Printer State: idle
  ...
  ⚠️  Active Alerts:
    🔴 [NEW] CRITICAL: Paper tray is empty
       Group: 8, Index: 1, Code: 1234
```

## Stopping the Monitor

Press `Ctrl+C` to gracefully stop the monitor.

## Troubleshooting

### "SNMP query failed"
- Check that the printer IP is correct
- Verify the printer is on the same network
- Ensure SNMP is enabled on the printer
- Try a different SNMP community string (some printers use "public", others use "private" or a custom string)

### "Could not get initial status"
- The printer may not support SNMP
- The printer may require SNMP v3 (this script uses v2c)
- Check firewall settings

### No ink/paper data
- Some printers don't report this information via SNMP
- The printer may use different OIDs (HP vs Canon vs Epson, etc.)

## SNMP OIDs Used

The script queries these SNMP OIDs:

**Status:**
- `1.3.6.1.2.1.25.3.5.1.1.1` - Printer status
- `1.3.6.1.2.1.25.3.2.1.5.1` - Device status
- `1.3.6.1.2.1.25.3.5.1.2.1` - Error state

**Ink/Toner (Marker Supplies):**
- `1.3.6.1.2.1.43.11.1.1.9` - Supply levels
- `1.3.6.1.2.1.43.11.1.1.8` - Max capacity
- `1.3.6.1.2.1.43.11.1.1.6` - Descriptions

**Paper Trays (Input):**
- `1.3.6.1.2.1.43.8.2.1.10` - Current level
- `1.3.6.1.2.1.43.8.2.1.9` - Max capacity
- `1.3.6.1.2.1.43.8.2.1.18` - Descriptions
- `1.3.6.1.2.1.43.8.2.1.11` - Status

**Alerts:**
- `1.3.6.1.2.1.43.18.1.1.8` - Alert descriptions
- `1.3.6.1.2.1.43.18.1.1.2` - Alert groups
- `1.3.6.1.2.1.43.18.1.1.3` - Group indexes
- `1.3.6.1.2.1.43.18.1.1.7` - Alert codes
- `1.3.6.1.2.1.43.18.1.1.4` - Severity levels
