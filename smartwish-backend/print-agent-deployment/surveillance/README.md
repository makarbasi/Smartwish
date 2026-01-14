# SmartWish Kiosk Surveillance System

People counting system using YOLO-based person detection for SmartWish kiosks.

## Overview

This surveillance module:
- Tracks people using webcam and YOLO AI model
- Saves images of detected people after 2 seconds (10 frames at 5 FPS)
- Counts people who stay longer than 8 seconds
- Reports detections to cloud server for analytics
- Serves images via local HTTP server for admin dashboard

## Requirements

### Python Dependencies

```bash
pip install -r requirements.txt
```

Or manually:
```bash
pip install ultralytics opencv-python requests
```

### YOLO Model

The system uses YOLO for person detection. Download one of these models and place it in this folder:
- `yolo26n.pt` (recommended - fast and accurate)
- `yolo11n.pt`
- `yolov8n.pt`

If no model is found, it will attempt to download `yolov8n.pt` automatically.

## Configuration

### Via Environment Variables

Set these in your `.env` file or system environment:

```env
# Required
SURVEILLANCE_ENABLED=true
KIOSK_ID=kiosk-001
KIOSK_API_KEY=your-kiosk-api-key

# Optional
SURVEILLANCE_WEBCAM=0           # Webcam device index (default: 0)
SURVEILLANCE_PORT=8765          # Local HTTP server port (default: 8765)
SURVEILLANCE_PREVIEW=false      # Show OpenCV preview window (default: false)
PYTHON_PATH=python              # Path to Python executable (default: python)
```

### Via Admin Dashboard

1. Go to Admin > Kiosks
2. Edit a kiosk configuration
3. Scroll to "Surveillance / People Counting" section
4. Enable surveillance and configure settings

## Running

### Integrated with Print Agent (Recommended)

The surveillance system starts automatically when you run the local print agent:

```bash
# Set environment variables
set SURVEILLANCE_ENABLED=true
set KIOSK_ID=your-kiosk-id
set KIOSK_API_KEY=your-api-key

# Start print agent (includes surveillance)
node local-print-agent.js
```

### Standalone Mode

Run the Python script directly for testing:

```bash
python count_people.py --kiosk-id=test-kiosk --api-key=test-key --server-url=https://smartwish.onrender.com
```

#### All Options

```
--kiosk-id          Unique kiosk identifier (required)
--server-url        Cloud server URL (default: https://smartwish.onrender.com)
--api-key           Kiosk API key for authentication (required)
--webcam-index      Webcam device index (default: 0)
--output-dir        Directory for saved images (default: ./saved_detections)
--dwell-threshold   Seconds before counting a person (default: 8)
--frame-threshold   Frames before saving image (default: 10)
--http-port         Port for local HTTP server (default: 8765)
--no-preview        Disable OpenCV preview window
--batch-interval    Seconds between batch uploads (default: 30)
```

## Output

### Local Storage

Images are saved to:
```
saved_detections/
├── 2026-01-14/
│   └── kiosk-001/
│       ├── id_115_10-07-40.jpg
│       ├── id_117_10-08-07.jpg
│       └── ...
└── ...
```

### Cloud Database

Detections are uploaded to Supabase tables:
- `surveillance_detections` - Individual person detections
- `surveillance_daily_stats` - Aggregated daily statistics

### Local HTTP Server

**Live Streaming:**
```
http://localhost:8765/stream      # MJPEG live stream (for admin dashboard)
http://localhost:8765/frame       # Single frame (JPEG)
http://localhost:8765/status      # JSON status
```

**Saved Images:**
```
http://localhost:8765/2026-01-14/kiosk-001/id_115_10-07-40.jpg
```

## Admin Dashboard

Access surveillance data at:
```
/admin/kiosks/{kioskId}/surveillance
```

Features:
- Real-time people count
- Today/week/month statistics
- Daily traffic chart
- Detection image gallery
- Filter by date range
- Bulk delete functionality

## Troubleshooting

### "Failed to open webcam"

1. Check webcam is connected: `--webcam-index=0`
2. Try different index: `--webcam-index=1`
3. On Windows, check Device Manager for camera

### "YOLO model not found"

1. Download model from https://github.com/ultralytics/ultralytics
2. Place `yolov8n.pt` in this folder

### "Detections not uploading"

1. Check API key is correct
2. Verify server URL is accessible
3. Check network connectivity

### "Python not found"

1. Install Python 3.8+
2. Add to PATH or set `PYTHON_PATH` environment variable

## Performance

- Target: 5 FPS processing
- Memory: ~500MB with YOLO model loaded
- CPU: ~30-50% on modern CPU
- GPU: Supports CUDA for faster inference (optional)

## Security Notes

- Images are stored locally on the kiosk computer
- Only metadata (paths, timestamps) are sent to cloud
- Local HTTP server only accessible on localhost by default
- API key required for all cloud uploads
