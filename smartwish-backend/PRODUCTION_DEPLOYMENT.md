# Production Print Agent Deployment Guide

This guide shows you how to deploy the SmartWish Print Agent to a production machine (different from your development machine).

## What You Need

### 1. Software to Install on Production Machine

- **Node.js** (version 18.0.0 or higher)
  - Download from: https://nodejs.org/
  - Install the LTS version
  - Verify installation: `node --version` (should show v18.x.x or higher)

- **Printer Drivers**
  - Install the printer drivers for your specific printer
  - Make sure the printer is set up and working in Windows

### 2. Files to Copy

Copy ONLY these files/folders to the production machine:

```
📁 smartwish-print-agent/
  ├── 📄 local-print-agent.js          (Main print agent script)
  ├── 📄 package.json                   (Dependencies list - production only)
  ├── 📄 start-print-agent.ps1         (PowerShell startup script)
  ├── 📄 start-print-agent.bat          (Batch startup script)
  ├── 📄 setup-print-agent-service.ps1  (Auto-start setup script)
  └── 📁 temp-print-jobs/               (Will be created automatically)
```

**You do NOT need:**
- ❌ `node_modules/` folder (will be installed fresh)
- ❌ `backend/` folder (only need the print agent)
- ❌ `src/` folder (TypeScript source code)
- ❌ `dist/` folder (compiled code)
- ❌ Any test files
- ❌ Any development dependencies

---

## Step-by-Step Deployment

### Step 1: Prepare Files on Development Machine

1. **Create a deployment folder:**
   ```powershell
   # On your development machine
   cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
   mkdir print-agent-deployment
   ```

2. **Copy the print agent file:**
   ```powershell
   copy backend\local-print-agent.js print-agent-deployment\
   ```

3. **Create a minimal package.json:**
   ```powershell
   # Copy the template (see below) or create manually
   ```

4. **Copy startup scripts:**
   ```powershell
   copy start-print-agent.ps1 print-agent-deployment\
   copy start-print-agent.bat print-agent-deployment\
   copy setup-print-agent-service.ps1 print-agent-deployment\
   ```

5. **Zip the folder:**
   ```powershell
   Compress-Archive -Path print-agent-deployment -DestinationPath print-agent-deployment.zip
   ```

### Step 2: Transfer to Production Machine

Transfer `print-agent-deployment.zip` to the production machine via:
- USB drive
- Network share
- Email (if small enough)
- Cloud storage (Google Drive, OneDrive, etc.)

### Step 3: Setup on Production Machine

1. **Extract the zip file:**
   ```powershell
   # Extract to a permanent location, e.g.:
   C:\Program Files\SmartWish\PrintAgent\
   # or
   D:\SmartWish\PrintAgent\
   ```

2. **Open PowerShell in the extracted folder**

3. **Install dependencies:**
   ```powershell
   npm install --production
   ```
   This installs only production dependencies (no dev tools).

4. **Configure the printer:**
   - Open `start-print-agent.ps1` in Notepad
   - Update line 10: `$env:DEFAULT_PRINTER = "YOUR_PRINTER_NAME"`
   - Find your exact printer name in Windows Settings → Printers & scanners

5. **Configure the server URL (if different):**
   - Update line 9: `$env:CLOUD_SERVER_URL = "https://your-server.com"`

6. **Test run:**
   ```powershell
   .\start-print-agent.ps1
   ```
   - Verify it connects to the server
   - Check that it can see your printer
   - Press Ctrl+C to stop

### Step 4: Setup Auto-Start on Reboot

**Run as Administrator:**
```powershell
# Right-click PowerShell → Run as Administrator
cd C:\Program Files\SmartWish\PrintAgent
.\setup-print-agent-service.ps1
```

This creates a Windows Task Scheduler task that starts the agent on every reboot.

---

## Minimal package.json for Production

Create this `package.json` file in your deployment folder:

```json
{
  "name": "smartwish-print-agent",
  "version": "1.0.0",
  "description": "SmartWish Local Print Agent - Production",
  "type": "module",
  "main": "local-print-agent.js",
  "scripts": {
    "start": "node local-print-agent.js"
  },
  "dependencies": {
    "pdf-to-printer": "^5.6.0",
    "pdf-lib": "^1.17.1",
    "sharp": "^0.33.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Note:** `node-fetch` is NOT needed - the script uses native `fetch()` available in Node.js 18+.

---

## Quick Deployment Script

Save this as `prepare-deployment.ps1` on your development machine:

```powershell
# Prepare Print Agent for Production Deployment
$deployDir = "print-agent-deployment"
$zipFile = "$deployDir.zip"

Write-Host "Preparing Print Agent for deployment..." -ForegroundColor Cyan

# Create deployment directory
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy required files
Copy-Item "backend\local-print-agent.js" "$deployDir\" -Force
Copy-Item "start-print-agent.ps1" "$deployDir\" -Force
Copy-Item "start-print-agent.bat" "$deployDir\" -Force
Copy-Item "setup-print-agent-service.ps1" "$deployDir\" -Force

# Create minimal package.json
$packageJson = @{
    name = "smartwish-print-agent"
    version = "1.0.0"
    description = "SmartWish Local Print Agent - Production"
    type = "module"
    main = "local-print-agent.js"
    scripts = @{
        start = "node local-print-agent.js"
    }
    dependencies = @{
        "pdf-to-printer" = "^5.6.0"
        "pdf-lib" = "^1.17.1"
        "sharp" = "^0.33.5"
    }
    engines = @{
        node = ">=18.0.0"
    }
} | ConvertTo-Json -Depth 10

$packageJson | Out-File "$deployDir\package.json" -Encoding UTF8

# Create README
$readme = @"
# SmartWish Print Agent - Production

## Installation

1. Install Node.js 18+ from https://nodejs.org/
2. Run: npm install --production
3. Configure printer name in start-print-agent.ps1
4. Test: .\start-print-agent.ps1
5. Setup auto-start: .\setup-print-agent-service.ps1 (as Administrator)

## Configuration

Edit start-print-agent.ps1:
- DEFAULT_PRINTER: Your printer name
- CLOUD_SERVER_URL: Your backend server URL
"@

$readme | Out-File "$deployDir\README.txt" -Encoding UTF8

# Create zip
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}
Compress-Archive -Path $deployDir -DestinationPath $zipFile

Write-Host ""
Write-Host "✓ Deployment package created: $zipFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Transfer $zipFile to production machine"
Write-Host "2. Extract and run: npm install --production"
Write-Host "3. Configure printer name"
Write-Host "4. Test and setup auto-start"
```

Run it:
```powershell
cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
.\prepare-deployment.ps1
```

---

## Production Machine Checklist

- [ ] Node.js 18+ installed
- [ ] Printer installed and working
- [ ] Files extracted to permanent location
- [ ] Dependencies installed (`npm install --production`)
- [ ] Printer name configured in `start-print-agent.ps1`
- [ ] Server URL configured (if different)
- [ ] Test run successful
- [ ] Auto-start configured (Task Scheduler)
- [ ] Verified it starts on reboot

---

## Troubleshooting

### "Cannot find module"
- Run `npm install --production` in the deployment folder
- Make sure `package.json` exists

### "Printer not found"
- Check printer name exactly matches Windows printer name
- Verify printer is online and shared
- List printers: `node -e "import('pdf-to-printer').then(m => m.default.getPrinters().then(console.log))"`

### "Cannot connect to server"
- Check internet connection
- Verify CLOUD_SERVER_URL is correct
- Check firewall settings
- Test: `curl https://your-server.com/print-jobs` (or use browser)

### Service won't start
- Run Task Scheduler as Administrator
- Check Windows Event Viewer for errors
- Verify Node.js is in PATH or use full path

---

## File Structure Summary

**Development Machine:**
```
smartwish-backend/
  ├── backend/
  │   └── local-print-agent.js  ← Copy this
  ├── start-print-agent.ps1     ← Copy this
  ├── start-print-agent.bat     ← Copy this
  └── setup-print-agent-service.ps1  ← Copy this
```

**Production Machine:**
```
C:\Program Files\SmartWish\PrintAgent\
  ├── local-print-agent.js
  ├── package.json              ← Create this (minimal)
  ├── start-print-agent.ps1
  ├── start-print-agent.bat
  ├── setup-print-agent-service.ps1
  ├── node_modules/             ← Created by npm install
  └── temp-print-jobs/         ← Created automatically
```

---

## Security Notes

- The print agent only needs to **read** print jobs from your server
- It does NOT need database access
- It does NOT need admin privileges (except for auto-start setup)
- Keep the server URL and printer name secure
- Consider using environment variables for sensitive config

