# SmartWish Print Agent - Production Deployment

## Quick Start

1. Install Node.js 18+
   - Download from: https://nodejs.org/
   - Install the LTS version
   - Verify: node --version

2. Install Dependencies
   - Open PowerShell in this folder
   - Run: npm install --production

3. Configure Printer (Optional)
   - Default printer: HP OfficeJet Pro 9130e Series [HPIE4B65B]
   - To change: Edit start-print-agent.ps1, line 14
   - Find printer name in Windows Settings -> Printers & scanners

4. Configure Server URL (if different)
   - Edit: start-print-agent.ps1
   - Update line 13: CLOUD_SERVER_URL = "https://your-server.com"

5. Test Run
   - Run: .\start-print-agent.ps1
   - Verify it connects and sees your printer
   - Press Ctrl+C to stop

6. Setup Auto-Start
   - Run: .\setup-print-agent-service.ps1
   - Choose Option 1 (Startup Folder) - Simple, no admin needed
   - Or Option 2 (Task Scheduler) - Requires admin

## Files Included

- local-print-agent.js - Main print agent script
- package.json - Production dependencies
- start-print-agent.ps1 - PowerShell startup script
- start-print-agent.bat - Batch startup script (alternative)
- setup-print-agent-service.ps1 - Auto-start setup script
- print-with-tray.ps1 - Helper script for tray selection
- list-printer-trays.ps1 - Utility to discover printer tray names

## Tray Selection (HP Printers)

The print agent supports printing to specific trays:
- Tray 1: Sticker paper (single-sided)
- Tray 2: Card stock (duplex/two-sided)

For reliable tray selection, install SumatraPDF:
1. Download from: https://www.sumatrapdfreader.org/download-free-pdf-viewer
2. Install (portable or regular version)
3. Restart the print agent

To check your printer trays:
   powershell -ExecutionPolicy Bypass -File list-printer-trays.ps1 -PrinterName "HP OfficeJet Pro 9135e"

If tray selection doesn't work:
1. Open Control Panel → Devices and Printers
2. Right-click your HP printer → Printing Preferences
3. Go to Paper/Quality tab
4. Set Paper Source to the desired tray
5. Click OK

## Auto-Start Options

Option 1: STARTUP FOLDER (Recommended)
- Simple setup, no admin required
- Starts when you log in
- Runs minimized in background

Option 2: TASK SCHEDULER
- Requires admin rights
- Starts at system boot
- More control over settings

## Troubleshooting

- Cannot find module: Run npm install --production
- Printer not found: Check printer name matches exactly (case sensitive!)
- Cannot connect: Check internet and server URL
- Script won't run: Enable PowerShell scripts:
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
- Agent crashes: Check Node.js is installed correctly

## Current Default Configuration

Server: https://smartwish.onrender.com
Printer: HP OfficeJet Pro 9130e Series [HPIE4B65B]
Poll Interval: 5 seconds
