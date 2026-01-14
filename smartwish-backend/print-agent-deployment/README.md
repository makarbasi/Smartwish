# SmartWish Local Print Agent

The local print agent runs on each kiosk device to handle printing and surveillance.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **First Time Setup**
   - Run `start-print-agent.bat` (Windows) or `node local-print-agent.js`
   - A browser will open to the SmartWish Manager dashboard
   - Log in with your manager credentials
   - Select the kiosk you want to pair with this device
   - Click "Pair Device"

3. **Auto-Start on Windows**
   - Run `install-autostart.bat` to configure auto-start on login
   - This creates a shortcut in your Startup folder

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

All settings are managed in the SmartWish Admin Panel:
- **Kiosk Settings** → Edit kiosk → Configure surveillance
- Changes are automatically picked up when the agent restarts

## Surveillance Setup

If surveillance is enabled for your kiosk:

### Python Requirements

1. Install Python 3.8 or higher
2. Install dependencies:
   ```bash
   cd surveillance
   pip install -r requirements.txt
   ```

3. Download YOLO model (auto-downloaded on first run)

### Webcam Configuration

Configure in Admin Panel → Kiosks → Edit → Surveillance:
- `webcamIndex`: Camera device index (0 = default camera)
- `httpPort`: Port for the local image server (default: 8765)
- `dwellThresholdSeconds`: Time person must be visible to count (default: 8)
- `frameThreshold`: Frames person must be detected (default: 10)

## Files

| File | Purpose |
|------|---------|
| `local-print-agent.js` | Main agent script |
| `device-pairing.js` | Handles device-to-kiosk pairing |
| `device-pairing.json` | Stored pairing (created after first pairing) |
| `surveillance-manager.js` | Manages Python surveillance process |
| `surveillance/count_people.py` | Python script for person counting |
| `start-print-agent.bat` | Windows launcher script |
| `install-autostart.bat` | Installs auto-start on login |

## Troubleshooting

### Print agent won't start
- Make sure Node.js is installed (`node --version`)
- Run `npm install` to install dependencies

### Can't pair device
- Make sure you're logged in as a manager
- Check that the kiosk is assigned to your manager account
- The browser must be on the same machine as the print agent

### Surveillance not working
- Check Python is installed (`python --version`)
- Install requirements: `pip install -r surveillance/requirements.txt`
- Check the webcam index is correct

### Re-pairing a device
- Delete `device-pairing.json`
- Restart the print agent
- The browser will open for re-pairing

## Ports Used

| Port | Service |
|------|---------|
| 8765 | Surveillance image server |
| 8766 | Device pairing server |
