# SmartWish Local Print Agent

The local print agent runs on each kiosk device to handle printing, surveillance, and events scraping.

## 🚀 Quick Deployment Checklist

Use this checklist when setting up a **new kiosk machine**:

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Copy `print-agent-deployment` folder to kiosk | Folder exists |
| 2 | Run `setup-kiosk.bat` | All checks pass ✅ |
| 3 | Edit `config.json` if needed | URLs are correct |
| 4 | Run `start-print-agent.bat` | Browser opens |
| 5 | Log in and pair device | `device-pairing.json` created |
| 6 | *(Optional)* Run `install-autostart.bat` | Starts on boot |

---

## First Time Setup on New Kiosk

### Step 1: Copy Files

Copy the entire `print-agent-deployment` folder to the kiosk machine.

### Step 2: Run Setup Script

Double-click `setup-kiosk.bat` or run in Command Prompt:

```cmd
cd print-agent-deployment
setup-kiosk.bat
```

This will:
- ✅ Check Node.js is installed (required: 18+)
- ✅ Check Python is installed (required: 3.8+)
- ✅ Install Node.js dependencies (`npm install`)
- ✅ Install Python surveillance dependencies
- ✅ Verify YOLO model files exist

### Step 3: Configure URLs (if needed)

Edit `config.json` to set the correct URLs:

**Production (default):**
```json
{
  "cloudServerUrl": "https://smartwish.onrender.com",
  "frontendUrl": "https://app.smartwish.us"
}
```

**Local Development:**
```json
{
  "cloudServerUrl": "http://localhost:3001",
  "frontendUrl": "http://localhost:3000"
}
```

### Step 4: Start and Pair Device

1. Run `start-print-agent.bat`
2. A browser will open to the SmartWish Manager dashboard
3. Log in with your manager credentials
4. Select the kiosk you want to pair with this device
5. Click "Pair Device"

After pairing, a `device-pairing.json` file is created with the kiosk ID and API key.

### Step 5: Auto-Start (Optional)

Run `install-autostart.bat` to configure the agent to start automatically on Windows login.

---

## How It Works

### Device Pairing Flow

1. **First Boot**: The print agent starts a local pairing server (port 8766)
2. **Browser Opens**: Automatically opens the manager dashboard with `?pair=true`
3. **Manager Selects Kiosk**: You log in and choose which kiosk this device represents
4. **Configuration Saved**: The kiosk ID and API key are saved locally (`device-pairing.json`)
5. **Config Fetched**: The agent fetches the full kiosk configuration from the cloud

### After Pairing

On subsequent starts:
1. The agent reads the saved pairing from `device-pairing.json`
2. Fetches the latest configuration from the cloud
3. Starts surveillance (if enabled in kiosk settings)
4. Begins polling for print jobs

### Cloud Configuration

All kiosk-specific settings are managed in the SmartWish Admin Panel:
- **Kiosk Settings** → Edit kiosk → Configure surveillance
- Changes are automatically picked up when the agent restarts

---

## Surveillance Setup

If surveillance is enabled for your kiosk, the `setup-kiosk.bat` script will install the Python requirements automatically.

### Manual Installation (if needed)

```bash
cd surveillance
pip install -r requirements.txt
```

### Webcam Troubleshooting

Configure in Admin Panel → Kiosks → Edit → Surveillance:
- `webcamIndex`: Camera device index (0 = default camera, try 1 or 2 if not working)
- `showPreview`: Set to `true` to see camera output for debugging

---

## Files Reference

| File | Purpose |
|------|---------|
| `setup-kiosk.bat` | **Run first!** Installs all dependencies |
| `start-print-agent.bat` | Starts the print agent |
| `config.json` | Configuration file (URLs, settings) |
| `config.example.json` | Example config with documentation |
| `device-pairing.json` | Stored kiosk ID and API key (created after pairing) |
| `local-print-agent.js` | Main agent script |
| `surveillance-manager.js` | Manages Python surveillance process |
| `surveillance/count_people.py` | Python script for person counting |
| `install-autostart.bat` | Installs auto-start on login |

---

## Ports Used (Local Only)

| Port | Service |
|------|---------|
| 8765 | Surveillance image server |
| 8766 | Device pairing server |

These are LOCAL services on the kiosk machine, not cloud connections.

---

## Troubleshooting

### Print agent won't start
- Run `setup-kiosk.bat` to verify all dependencies
- Make sure Node.js 18+ is installed (`node --version`)

### Can't pair device
- Make sure you're logged in as a manager
- Check that the kiosk is assigned to your manager account
- The browser must be on the same machine as the print agent

### Surveillance not working
- Check Python is installed (`python --version`)
- Run `pip install -r surveillance/requirements.txt`
- Check the webcam index is correct (try 0, 1, or 2)
- Set `showPreview: true` in config to debug camera issues

### Re-pairing a device
- Delete `device-pairing.json`
- Restart the print agent
- The browser will open for re-pairing

### Camera shows wrong source
- Run `python surveillance/find_webcam.py` to list available cameras
- Update webcamIndex in Admin Panel or config.json
