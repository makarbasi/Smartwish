# SmartWish Print Agent - Production Deployment

## Quick Start

1. Install Node.js 18+
   - Download from: https://nodejs.org/
   - Install the LTS version
   - Verify: node --version
   - Recommended: Node.js 20 LTS (some dependencies may not install on Node 25+)

2. Install Dependencies
   - Open PowerShell in this folder
   - Run: npm install --omit=dev

3. Configure Printer
   - Edit: start-print-agent.ps1
   - Update line 10: DEFAULT_PRINTER = "YOUR_PRINTER_NAME"
   - Find printer name in Windows Settings -> Printers & scanners

4. Configure Server URL (if different)
   - Edit: start-print-agent.ps1
   - Update line 9: CLOUD_SERVER_URL = "https://your-server.com"

5. Configure Duplex + Borderless (recommended)
   - Edit: start-print-agent.ps1
   - DEFAULT_DUPLEX_SIDE:
       simplex | duplex | duplexshort | duplexlong
       For greeting cards (landscape): duplexshort
   - BORDERLESS:
       true/false
   - BORDERLESS_PAPER_SIZE:
       IMPORTANT: this must match a paper size supported by your printer driver.
       Common examples: "Letter (Borderless)", "A4 (Borderless)"
       If your printer doesn't expose a borderless size, leave this blank and configure borderless in the printer driver UI.
   - DEFAULT_PAPER_SIZE:
       Used when borderless paper size isn't available (default: "Letter")

5. Test Run
   - Run: .\start-print-agent.ps1
   - Verify it connects and sees your printer
   - Press Ctrl+C to stop

6. Setup Auto-Start (as Administrator)
   - Run: .\setup-print-agent-service.ps1
   - This creates a Task Scheduler task for auto-start on reboot

## Print Job Formats (Agent Supports Both)

1) PDF job (preferred)
   The cloud queue item should include:
     - pdfUrl: "https://app.smartwish.us/downloads/print-jpegs/<file>.pdf"
       OR
     - pdfData: "data:application/pdf;base64,...." (or raw base64)
   Optional print overrides:
     - duplexSide: "duplexshort" | "duplexlong" | "duplex" | "simplex"
     - borderless: true/false
     - borderlessPaperSize: "Letter (Borderless)" (exact driver paper size name)
     - paperSize: "Letter" (or another supported size)
     - copies: 1..N

2) Legacy image job (backwards compatible)
   The cloud queue item includes:
     - imagePaths: [page1, page2, page3, page4] (URLs or local paths)
   The agent will compose the two-page PDF locally and print it.

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
