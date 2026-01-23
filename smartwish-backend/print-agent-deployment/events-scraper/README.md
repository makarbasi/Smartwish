# Events Scraper

This scraper collects events from Eventbrite for San Diego and generates an HTML display page for the kiosk.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the scraper:
```bash
python scrape_events.py
```

This will:
- Scrape events from Eventbrite
- Download event images to the `images/` folder
- Generate `event_data.js` with the event data
- The `index.html` file will load this data for display

## Files

- `scrape_events.py` - Main scraper script
- `index.html` - HTML template for displaying events
- `event_data.js` - Generated event data (created by scraper)
- `images/` - Downloaded event images (created by scraper)
- `requirements.txt` - Python dependencies

## Integration

The print agent runs this scraper daily to keep events updated. The Events advertisement page loads the generated HTML.
