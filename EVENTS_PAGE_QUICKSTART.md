# Events Advertisement Page - Quick Start

## ✅ What's Been Set Up

The Events advertisement page is now fully integrated into your Smartwish kiosk system!

### Components Created:

1. **Frontend Page**: `/kiosk/advertisement/Events`
   - Location: `smartwish-frontend/src/app/kiosk/advertisement/Events/page.tsx`
   - Loads event HTML in an iframe
   - Includes back-to-home button and printer alerts

2. **Events Scraper**:
   - Location: `smartwish-backend/print-agent-deployment/events-scraper/`
   - Python script that scrapes Eventbrite daily
   - Downloads event images automatically
   - Generates beautiful HTML display

3. **Scraper Manager**:
   - Location: `smartwish-backend/print-agent-deployment/events-scraper-manager.js`
   - Runs the Python scraper on schedule
   - Deploys content to frontend automatically
   - Integrated with print agent

4. **Initial Content**:
   - Location: `smartwish-frontend/public/events/`
   - Pre-populated with current San Diego events
   - Ready to display immediately!

## 🚀 Quick Start (3 Steps)

### Step 1: Install Python Dependencies

```powershell
cd smartwish-backend/print-agent-deployment/events-scraper
./setup.ps1
```

### Step 2: Start the Print Agent

The scraper runs automatically with the print agent:

```bash
cd smartwish-backend/print-agent-deployment
node local-print-agent.js
```

You'll see:
```
📅 Starting Events Scraper Manager...
✅ Events scraper started
🚀 Starting Eventbrite scraper...
✅ Scraper completed successfully
📦 Deploying content to frontend...
✅ Content deployed successfully
```

### Step 3: View the Page

Navigate to: `/kiosk/advertisement/Events`

- On dev: `http://localhost:3000/kiosk/advertisement/Events`
- On production: `https://app.smartwish.us/kiosk/advertisement/Events`

## 📁 File Structure

```
smartwish/
├── smartwish-backend/
│   └── print-agent-deployment/
│       ├── config.json (✅ Updated with eventsScraper config)
│       ├── local-print-agent.js (✅ Integrated scraper)
│       ├── events-scraper-manager.js (✅ New manager script)
│       └── events-scraper/
│           ├── scrape_events.py (✅ Python scraper)
│           ├── index.html (✅ Display template)
│           ├── requirements.txt (✅ Dependencies)
│           ├── setup.ps1 (✅ Setup script)
│           └── README.md (✅ Documentation)
│
└── smartwish-frontend/
    ├── src/app/kiosk/advertisement/
    │   └── Events/
    │       └── page.tsx (✅ New Events page)
    │
    └── public/events/ (✅ Pre-populated with content)
        ├── index.html
        ├── event_data.js
        └── images/ (92 event images)
```

## ⚙️ Configuration

Edit `config.json` to customize:

```json
{
  "eventsScraper": {
    "enabled": true,           // Enable/disable scraper
    "runOnStartup": true,      // Run immediately on startup
    "scheduleTime": "03:00"    // Daily run time (3 AM)
  }
}
```

## 🎯 Features

- **Auto-scrolling carousel**: Events scroll automatically
- **QR codes**: Each event has a scannable QR code
- **Categories**: 
  - Popular in San Diego
  - This Weekend
  - Music Events
  - Food & Drink Events
  - Health & Wellness Events
  - After 8pm Events
- **Beautiful design**: Gradient backgrounds, animations, card layouts
- **Daily updates**: Fresh events every day at 3 AM
- **Portrait mode**: Optimized for 1080x1920 kiosk displays

## 🔗 How to Access

From the kiosk home screen, you can:

1. **Direct navigation**: `/kiosk/advertisement/Events`
2. **Link from home**: Add to kiosk home screen
3. **Advertisement rotation**: Include in ad rotation
4. **Screen saver**: Set as screen saver option

## 📝 What Happens Daily

1. **3:00 AM**: Scraper wakes up
2. **Scraping**: Collects latest San Diego events from Eventbrite
3. **Processing**: Downloads event images, parses data
4. **Deployment**: Copies HTML, JS, and images to frontend
5. **Live**: Updated events appear on kiosk automatically

## 🧪 Testing

### Test the full workflow:

```bash
# Test scraper manually
cd smartwish-backend/print-agent-deployment/events-scraper
python scrape_events.py

# Test manager manually  
cd ..
node events-scraper-manager.js

# View the page
# Navigate to: http://localhost:3000/kiosk/advertisement/Events
```

## 📊 Monitoring

Check logs for status:

- **Scraper log**: `events-scraper/scraper.log`
- **Console output**: Print agent shows scraper status
- **Browser console**: Frontend page errors (if any)

## 💡 Tips

1. **First run takes longer**: ChromeDriver downloads on first run
2. **Events cached 24h**: One scrape per day keeps load low
3. **Images local**: All images stored locally for fast loading
4. **Kiosk optimized**: Portrait 1080x1920, touch-friendly
5. **No internet needed**: Once scraped, events display offline

## 🎉 You're Done!

The Events page is now:
- ✅ Created and accessible
- ✅ Pre-populated with events
- ✅ Scheduled to update daily
- ✅ Integrated with print agent
- ✅ Ready for production

Just start the print agent and it works! 🚀

---

**Need help?** See `EVENTS_SCRAPER_SETUP.md` for detailed documentation.
