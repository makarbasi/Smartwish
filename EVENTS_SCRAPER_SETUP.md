# Events Advertisement Page Setup Guide

This guide explains the Events advertisement page for the kiosk, which displays live San Diego events from Eventbrite.

## Overview

The Events page scrapes Eventbrite daily to show:
- Popular events in San Diego
- Events happening this weekend
- Music events
- Food & Drink events
- Health & Wellness events
- Events after 8pm

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Print Agent (Local Machine)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  events-scraper-manager.js                             │ │
│  │  - Runs Python scraper daily at 3 AM                   │ │
│  │  - Copies output to frontend public folder             │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  events-scraper/                                        │ │
│  │  ├── scrape_events.py (Selenium scraper)               │ │
│  │  ├── index.html (Display template)                     │ │
│  │  ├── event_data.js (Generated data)                    │ │
│  │  └── images/ (Downloaded event images)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Copies files to
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  public/events/                                         │ │
│  │  ├── index.html                                         │ │
│  │  ├── event_data.js                                      │ │
│  │  └── images/                                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /kiosk/advertisement/Events/page.tsx                   │ │
│  │  - Loads /events/index.html in iframe                   │ │
│  │  - Displays events on kiosk                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Python Dependencies

On the machine running the print agent:

```powershell
cd smartwish-backend/print-agent-deployment/events-scraper
./setup.ps1
```

Or manually:
```bash
pip install selenium webdriver-manager requests
```

### 2. Configure the Print Agent

The configuration is already set in `config.json`:

```json
{
  "eventsScraper": {
    "enabled": true,
    "runOnStartup": true,
    "scheduleTime": "03:00"
  }
}
```

- `enabled`: Set to `true` to enable the scraper
- `runOnStartup`: If `true`, runs scraper immediately when print agent starts
- `scheduleTime`: Daily run time in HH:MM format (default: 3:00 AM)

### 3. Start the Print Agent

The events scraper will start automatically with the print agent:

```bash
cd smartwish-backend/print-agent-deployment
node local-print-agent.js
```

The scraper will:
1. Run immediately on startup (if `runOnStartup` is true)
2. Schedule daily runs at the configured time
3. Automatically deploy updated content to the frontend

## File Locations

### Backend (Print Agent)
- **Scraper script**: `smartwish-backend/print-agent-deployment/events-scraper/scrape_events.py`
- **Manager script**: `smartwish-backend/print-agent-deployment/events-scraper-manager.js`
- **Configuration**: `smartwish-backend/print-agent-deployment/config.json`

### Frontend
- **Page component**: `smartwish-frontend/src/app/kiosk/advertisement/Events/page.tsx`
- **Public assets**: `smartwish-frontend/public/events/`

## Manual Testing

### Test the Scraper Manually

```bash
cd smartwish-backend/print-agent-deployment/events-scraper
python scrape_events.py
```

This will:
- Scrape events from Eventbrite
- Download event images to `images/` folder
- Generate `event_data.js` with event data

### Test the Manager Script

```bash
cd smartwish-backend/print-agent-deployment
node events-scraper-manager.js
```

This will:
- Run the scraper
- Copy output files to `smartwish-frontend/public/events/`

### View the Events Page

1. Start the frontend dev server:
   ```bash
   cd smartwish-frontend
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/kiosk/advertisement/Events`

## Customization

### Change Event Categories

Edit `CATEGORY_URLS` in `scrape_events.py`:

```python
CATEGORY_URLS = {
    "Popular in San Diego": "https://www.eventbrite.com/d/ca--san-diego/events/",
    "Your Custom Category": "https://www.eventbrite.com/d/ca--san-diego/your-category/",
}
```

### Change Scrape Schedule

Edit `config.json`:

```json
{
  "eventsScraper": {
    "scheduleTime": "02:00"  // Run at 2 AM instead
  }
}
```

### Customize Display

Edit the HTML/CSS in `events-scraper/index.html` to match your branding.

## Accessing the Page on Kiosk

The page is accessible at:
```
/kiosk/advertisement/Events
```

You can link to it from:
- Kiosk home screen
- Advertisement rotation
- Screen saver

## Troubleshooting

### Scraper Not Running

1. Check Python is installed: `python --version`
2. Check dependencies: `pip list | findstr selenium`
3. Check print agent logs for errors
4. Check scraper log: `events-scraper/scraper.log`

### Events Not Displaying

1. Check files exist in `public/events/`:
   - `index.html`
   - `event_data.js`
   - `images/` folder

2. Check browser console for errors
3. Verify iframe is loading: View page source and check iframe src

### Images Not Loading

1. Check images were downloaded: `events-scraper/images/`
2. Check images were copied: `public/events/images/`
3. Check image paths in `event_data.js` are relative

## Logs

- **Scraper logs**: `events-scraper/scraper.log`
- **Print agent logs**: Console output
- **Frontend logs**: Browser console

## Notes

- The scraper uses headless Chrome via Selenium
- First run may be slow while ChromeDriver downloads
- Events are cached for 24 hours (one scrape per day)
- Initial event data is included, so the page works immediately
- The page auto-scrolls and displays QR codes for each event

## Support

If you encounter issues:
1. Check the logs
2. Test the scraper manually
3. Verify Python and dependencies are installed
4. Check that the print agent is running
5. Ensure the frontend has the files in `public/events/`
