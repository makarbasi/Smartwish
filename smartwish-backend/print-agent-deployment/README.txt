# SmartWish Print Agent - Production Deployment

## Quick Start

1. Install Node.js 18+
   - Download from: https://nodejs.org/
   - Install the LTS version
   - Verify: node --version

2. Install Dependencies
   - Open PowerShell in this folder
   - Run: npm install --production

3. Configure Printer
   - Edit: start-print-agent.ps1
   - Update line 10: DEFAULT_PRINTER = "YOUR_PRINTER_NAME"
   - Find printer name in Windows Settings -> Printers & scanners

4. Configure Server URL (if different)
   - Edit: start-print-agent.ps1
   - Update line 9: CLOUD_SERVER_URL = "https://your-server.com"

5. Test Run
   - Run: .\start-print-agent.ps1
   - Verify it connects and sees your printer
   - Press Ctrl+C to stop

6. Setup Auto-Start (as Administrator)
   - Run: .\setup-print-agent-service.ps1
   - This creates a Task Scheduler task for auto-start on reboot

## Files Included

- local-print-agent.js - Main print agent script
- package.json - Production dependencies
- start-print-agent.ps1 - PowerShell startup script
- start-print-agent.bat - Batch startup script
- setup-print-agent-service.ps1 - Auto-start setup script

## Troubleshooting

- Cannot find module: Run npm install --production
- Printer not found: Check printer name matches exactly
- Cannot connect: Check internet and server URL
- Service won't start: Run setup script as Administrator

For more details, see PRODUCTION_DEPLOYMENT.md
