# Half Letter Double-Sided Printing Guide

## ✅ Fix Applied

**Problem**: Print jobs were being sent to the remote server instead of your local backend.

**Solution**: Updated the print functions to use your **local backend** at `http://localhost:3001`.

---

## 📋 Checklist Before Printing

### 1. ✅ Make Sure Local Backend is Running

Your backend must be running locally for printing to work:

```bash
cd smartwish-backend/backend
npm run start
```

You should see:
```
🚀 Backend is running on http://localhost:3001
```

### 2. ✅ Configure Windows Printer Settings

**One-time setup for Half Letter paper:**

1. Open **Control Panel** → **Devices and Printers**
2. Right-click **EPSONC5F6AA (ET-15000 Series)**
3. Click **Printing Preferences**
4. Configure these settings:
   - **Paper Size**: Statement or Half Letter (5.5 × 8.5 inches)
   - **Orientation**: LANDSCAPE (8.5" wide × 5.5" tall)
   - **Duplex**: ON / Two-Sided Printing (flip on SHORT edge)
   - **Paper Type**: Heavyweight/Premium Matte
   - **Print Quality**: BEST / HIGHEST
   - **Borderless**: ON (recommended)
5. Click **Apply** → **OK**

### 3. ✅ Select Half Letter in the App

1. Go to your **Designs** page
2. Look at the top-right corner
3. Select **"Half Letter 8.5×5.5" (Auto-Duplex ✓)"** from the dropdown

You should see:
- ✓ Auto-duplex supported - printer will flip automatically
- ⚠ Card is 6" tall, paper is 5.5" - slight trim

### 4. ✅ Load Paper Correctly

- Use **Half Letter/Statement paper** (5.5 × 8.5 inches)
- Place in **LANDSCAPE orientation** (8.5" wide at top)
- Use **heavyweight cardstock** (200-300 GSM)

---

## 🖨️ Print Your Card

1. Click the **Print** button on any card
2. Watch the console for `Using print API: http://localhost:3001/print-pc`
3. The printer will automatically:
   - Print Side 1 (Back + Front panels)
   - Flip the paper
   - Print Side 2 (Inside panels)
4. **Result**: ONE double-sided card! 🎉

---

## ⚠️ Important Notes

### Paper Size vs Card Size
- Your card is **6" tall** (unfolded: 8" × 6")
- Half letter paper is **5.5" tall**
- The top and bottom will be **trimmed by 0.25" each** automatically

### If You Want NO Trimming
Use **Letter size** (11" × 8.5") instead:
- Select "Letter 11×8.5" (Auto-Duplex ✓)" from the dropdown
- The card will be centered with margins
- No trimming required

---

## 🐛 Troubleshooting

### Problem: "Failed to print" error

**Check**:
1. Is the local backend running? (`http://localhost:3001`)
2. Open browser console and look for the print API URL
3. Check backend console for error messages

### Problem: Print job sent but nothing prints

**Check**:
1. Is the EPSON ET-15000 printer online?
2. Check Windows Print Queue for errors
3. Verify printer name: `EPSONC5F6AA (ET-15000 Series)`

### Problem: Prints two separate pages instead of double-sided

**Check**:
1. Windows printer preferences: Duplex must be ON
2. Flip style: SHORT edge
3. Paper size: Must be "Statement" or "Half Letter" (standard size for auto-duplex)

---

## 🎯 Files Modified

- `smartwish-frontend/src/app/my-cards/page.tsx` (lines 813-827)
- `smartwish-frontend/src/app/my-cards/[id]/page.tsx` (lines 1077-1091)

Changed from:
```javascript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'}/print-pc`, {
```

To:
```javascript
const printApiUrl = process.env.NEXT_PUBLIC_PRINT_API_BASE || 'http://localhost:3001';
const response = await fetch(`${printApiUrl}/print-pc`, {
```

---

## 🎉 You're All Set!

Now try printing a card and it should work perfectly with double-sided printing on half letter paper!



