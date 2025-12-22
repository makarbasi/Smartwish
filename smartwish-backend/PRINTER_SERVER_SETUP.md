# Local Print Agent Setup Guide

This guide shows you how to run the local print agent and set it up to start automatically on Windows reboot.

## Quick Start

### Option 1: Run Manually (Testing)

**Using PowerShell:**
```powershell
cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
.\start-print-agent.ps1
```

**Using Command Prompt:**
```cmd
cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
start-print-agent.bat
```

**Direct Node.js:**
```cmd
cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
set CLOUD_SERVER_URL=https://smartwish.onrender.com
set DEFAULT_PRINTER=HPA4CC43 (HP Smart Tank 7600 series)
set POLL_INTERVAL=5000
node backend/local-print-agent.js
```

---

## Auto-Start on Reboot (Windows)

### Method 1: Windows Task Scheduler (Recommended)

1. **Open Task Scheduler:**
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task:**
   - Click "Create Basic Task" in the right panel
   - Name: `SmartWish Print Agent`
   - Description: `Starts SmartWish local print agent on system startup`

3. **Trigger:**
   - Select "When the computer starts"

4. **Action:**
   - Select "Start a program"
   - Program/script: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
   - Add arguments: `-ExecutionPolicy Bypass -File "D:\Projects\Smartwish\Code\Smartwish\smartwish-backend\start-print-agent.ps1"`
   - Start in: `D:\Projects\Smartwish\Code\Smartwish\smartwish-backend`

5. **Conditions:**
   - ✅ Uncheck "Start the task only if the computer is on AC power"
   - ✅ Check "Start the task only if the following network connection is available" (optional)

6. **Settings:**
   - ✅ Check "Run task as soon as possible after a scheduled start is missed"
   - ✅ Check "If the task fails, restart every: 1 minute" (up to 3 times)
   - Select "Do not start a new instance" (or "Run a new instance in parallel" if you want multiple)

7. **General Tab (Advanced):**
   - ✅ Check "Run whether user is logged on or not"
   - ✅ Check "Run with highest privileges"
   - Configure for: Windows 10/11

8. **Click OK** and enter your Windows password when prompted

---

### Method 2: Using NSSM (Node Service Manager) - More Robust

NSSM creates a proper Windows service that can auto-restart on failure.

1. **Download NSSM:**
   - Go to https://nssm.cc/download
   - Download the latest release (e.g., `nssm-2.24.zip`)
   - Extract to `C:\nssm` (or any location)

2. **Install the Service:**
   ```cmd
   # Open Command Prompt as Administrator
   cd C:\nssm\win64
   
   # Install the service
   nssm install SmartWishPrintAgent
   ```

3. **Configure the Service:**
   - A GUI window will open. Fill in:
     - **Path:** `C:\Program Files\nodejs\node.exe` (or your Node.js path)
     - **Startup directory:** `D:\Projects\Smartwish\Code\Smartwish\smartwish-backend`
     - **Arguments:** `backend/local-print-agent.js`
   
   - **Environment Variables:**
     - Click "Environment" tab
     - Add:
       - `CLOUD_SERVER_URL=https://smartwish.onrender.com`
       - `DEFAULT_PRINTER=HPA4CC43 (HP Smart Tank 7600 series)`
       - `POLL_INTERVAL=5000`

4. **Set Service Options:**
   - **Details Tab:**
     - Display name: `SmartWish Print Agent`
     - Description: `Local print agent for SmartWish greeting cards`
   
   - **Exit Actions Tab:**
     - Exit action: `Restart Application`
     - Delay: `5000` ms
   
   - **I/O Tab (Optional - for logging):**
     - Output: `D:\Projects\Smartwish\Code\Smartwish\smartwish-backend\logs\print-agent-output.log`
     - Error: `D:\Projects\Smartwish\Code\Smartwish\smartwish-backend\logs\print-agent-error.log`

5. **Start the Service:**
   ```cmd
   nssm start SmartWishPrintAgent
   ```

6. **Verify it's running:**
   ```cmd
   nssm status SmartWishPrintAgent
   ```

7. **To stop the service:**
   ```cmd
   nssm stop SmartWishPrintAgent
   ```

8. **To remove the service:**
   ```cmd
   nssm remove SmartWishPrintAgent confirm
   ```

---

## Method 3: Using PM2 (Process Manager) - Good for Development

PM2 is great for Node.js applications and can auto-start on reboot.

1. **Install PM2 globally:**
   ```cmd
   npm install -g pm2
   ```

2. **Create PM2 ecosystem file** (see `ecosystem.config.js` below)

3. **Start with PM2:**
   ```cmd
   cd D:\Projects\Smartwish\Code\Smartwish\smartwish-backend
   pm2 start ecosystem.config.js
   ```

4. **Save PM2 configuration:**
   ```cmd
   pm2 save
   ```

5. **Setup PM2 to start on reboot:**
   ```cmd
   pm2 startup
   ```
   (Follow the instructions it provides)

6. **Useful PM2 commands:**
   ```cmd
   pm2 list              # List all processes
   pm2 logs SmartWishPrintAgent  # View logs
   pm2 stop SmartWishPrintAgent  # Stop
   pm2 restart SmartWishPrintAgent  # Restart
   pm2 delete SmartWishPrintAgent  # Remove
   ```

---

## Configuration

### Update Printer Name

1. Find your printer name:
   - Open Windows Settings → Devices → Printers & scanners
   - Note the exact printer name

2. Update in one of these places:
   - `start-print-agent.ps1` (line 10)
   - `start-print-agent.bat` (line 16)
   - Environment variable in Task Scheduler/NSSM
   - `ecosystem.config.js` (if using PM2)

### Update Server URL

If your backend is hosted elsewhere, update:
- `CLOUD_SERVER_URL` environment variable
- Or modify `backend/local-print-agent.js` CONFIG object

---

## Troubleshooting

### Check if it's running:
```cmd
# Task Scheduler
taskschd.msc
# Look for "SmartWish Print Agent" task

# NSSM
nssm status SmartWishPrintAgent

# PM2
pm2 list
```

### View logs:
- Task Scheduler: Check "History" tab in Task Scheduler
- NSSM: Check the log files you specified in I/O tab
- PM2: `pm2 logs SmartWishPrintAgent`

### Common Issues:

1. **"Node.js not found"**
   - Add Node.js to PATH or use full path in Task Scheduler

2. **"Printer not found"**
   - Verify printer name exactly matches Windows printer name
   - Check printer is online and shared

3. **"Cannot connect to server"**
   - Check internet connection
   - Verify CLOUD_SERVER_URL is correct
   - Check firewall settings

4. **Service won't start**
   - Run as Administrator
   - Check Windows Event Viewer for errors
   - Verify Node.js and dependencies are installed

---

## Recommended: Method 1 (Task Scheduler)

For most users, **Task Scheduler** is the easiest and doesn't require additional software. It's built into Windows and works well for this use case.

