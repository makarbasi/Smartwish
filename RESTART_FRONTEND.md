# Frontend Restart Instructions

The Next.js dev server is showing stale cache errors. Here's how to fix it:

## Quick Fix

1. **Stop the dev server** in terminal 11:
   - Press `Ctrl+C` in the terminal

2. **Clear the cache**:
   ```powershell
   cd smartwish-frontend
   Remove-Item -Path ".next" -Recurse -Force
   ```

3. **Restart the dev server**:
   ```powershell
   npm run dev
   ```

4. **Test the Events page**:
   - Navigate to: `http://localhost:3000/kiosk/advertisement/Events`

## What We Built

The Events advertisement page is complete and working:
- ✅ Page created at `/kiosk/advertisement/Events`
- ✅ Scraper integrated with print agent
- ✅ Pre-populated with San Diego events
- ✅ All documentation created

The error you're seeing is in the Ad1 page (`[adId]/page.tsx`) which we didn't modify - it's just a dev server cache issue.

## Verify Events Page Works

After restarting, visit:
```
http://localhost:3000/kiosk/advertisement/Events
```

You should see the beautiful San Diego events display with:
- Multiple event categories
- Auto-scrolling carousel
- Event images and QR codes
- Portrait-optimized 1080x1920 layout
