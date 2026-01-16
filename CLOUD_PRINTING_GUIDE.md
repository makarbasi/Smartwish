# Cloud Printing Guide for SmartWish

## The Problem

When you deploy SmartWish to a cloud platform like **onrender.com**, the printing functionality doesn't work because:

1. **Localhost** → Your backend server runs on the same machine as your printer, so `pdf-to-printer` can access Windows printers directly ✅
2. **Cloud Server** → The cloud server is a Linux machine with NO printers connected ❌

## Solutions

We provide **two solutions** depending on your use case:

---

## Solution 1: Browser Print Dialog (Default for Production)

**Best for:** General users accessing the app from any computer

When users access SmartWish from the deployed site (e.g., `smartwish.onrender.com`), clicking "Print" will:

1. Open a new browser window with the print-optimized card layout
2. Trigger the browser's native print dialog
3. User selects their local printer from the browser dialog
4. Card prints to their connected printer

**No additional setup required!** This is now the default behavior for production mode.

### How It Works

- The frontend detects if it's running on `localhost` vs production
- **Localhost:** Uses direct backend printing (fast, no popup)
- **Production:** Uses browser print dialog (works everywhere)

---

## Solution 2: Local Print Agent (For Kiosk/Automated Printing)

**Best for:** Kiosk setups, automated printing stations, or when you need silent/no-popup printing in production

The Local Print Agent is a small script that runs on your LOCAL computer (the one connected to the printer). It polls the cloud server for pending print jobs and executes them automatically.

### Setup

1. **On your local computer** (with the printer), navigate to the backend folder:
   ```bash
   cd smartwish-backend
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

3. **Edit the configuration** in `start-print-agent.bat` or `start-print-agent.ps1`:
   ```batch
   set CLOUD_SERVER_URL=https://smartwish.onrender.com
   set DEFAULT_PRINTER=Your Printer Name Here
   set POLL_INTERVAL=5000
   ```

4. **Find your printer name:**
   - Open Windows Settings → Bluetooth & Devices → Printers & Scanners
   - Copy the EXACT name of your printer

5. **Run the agent:**
   
   **Using Batch (double-click):**
   ```
   start-print-agent.bat
   ```
   
   **Using PowerShell:**
   ```powershell
   .\start-print-agent.ps1
   ```
   
   **Using Node directly:**
   ```bash
   node local-print-agent.js
   ```

### How It Works

1. User clicks "Print" on the cloud website
2. Cloud server queues the print job
3. Local Print Agent polls for jobs every 5 seconds
4. Agent downloads images, creates PDF, and prints locally
5. Agent updates job status on cloud server

### Agent Output Example

```
═══════════════════════════════════════════════════════════
  🖨️  SMARTWISH LOCAL PRINT AGENT
═══════════════════════════════════════════════════════════
  Server: https://smartwish.onrender.com
  Poll Interval: 5000ms

📋 Available Printers:
──────────────────────────────────────────────────
  1. HPA4CC43 (HP Smart Tank 7600 series)
  2. Microsoft Print to PDF
──────────────────────────────────────────────────
  Default: HPA4CC43 (HP Smart Tank 7600 series)

🔄 Waiting for print jobs...
   Press Ctrl+C to stop

📬 Found 1 pending job(s)

📋 Processing job: job_1701936000_abc123
   Printer: HPA4CC43 (HP Smart Tank 7600 series)
   Images: 4
   Paper: Letter
  🔧 Creating composite images...
  📄 Creating PDF...
  🖨️ Printing to: HPA4CC43 (HP Smart Tank 7600 series)
  ✅ Print job sent successfully!
  ✅ Job job_1701936000_abc123 completed successfully!
```

---

## Printing Modes Comparison

| Feature | Browser Print | Local Print Agent |
|---------|--------------|-------------------|
| Setup | None | Run agent locally |
| User interaction | Click print, select printer | Automatic/silent |
| Works for any user | ✅ Yes | ❌ Only configured printer |
| Best for | General users | Kiosk/automation |
| Popup required | Yes (print dialog) | No |

---

## Troubleshooting

### Browser Print Issues

1. **Popup blocked:** Allow popups for the site in browser settings
2. **Images not loading:** Make sure image URLs are accessible (CORS)
3. **Wrong orientation:** Set printer to "Landscape" in the print dialog

### Local Print Agent Issues

1. **"Printer not found":** Double-check printer name matches exactly (case-sensitive)
2. **"Connection refused":** Make sure the cloud server URL is correct
3. **Jobs stuck in "pending":** Agent might have crashed, restart it
4. **Access denied:** Run as administrator if needed

---

## API Endpoints (For Developers)

The cloud server provides these endpoints for the print agent:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/print-pc` | POST | Queue a new print job |
| `/print-jobs` | GET | Get all print jobs |
| `/print-jobs/:jobId` | GET | Get specific job status |
| `/print-jobs/:jobId/status` | PUT | Update job status |

### Example: Queue a Print Job

```javascript
const response = await fetch('https://smartwish.onrender.com/print-pc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    images: [base64Image1, base64Image2, base64Image3, base64Image4],
    printerName: 'HP Smart Tank 7600',
    paperSize: 'letter' // or 'half-letter' or 'custom'
  })
});

const { jobId, status, requiresLocalAgent } = await response.json();
```

---

## Best Practices

1. **For home users:** Use the browser print dialog (no setup needed)
2. **For kiosk setups:** Use the Local Print Agent with auto-start
3. **For testing:** Use localhost mode for fastest printing
4. **Paper settings:** Always configure printer defaults in Windows for:
   - Paper Size: Letter (8.5 × 11)
   - Orientation: Landscape
   - Two-Sided: Flip on Short Edge
   - Quality: Best/High

