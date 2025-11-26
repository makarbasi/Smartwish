# Letter Size Borderless Printing Setup Guide

## ✅ Changes Made

1. **Default paper size**: Changed from Custom to **Letter** (best for EPSON ET-15000)
2. **PDF generation**: Automatically creates Letter-sized PDFs (11" × 8.5" landscape)
3. **Borderless printing**: Instructions updated for edge-to-edge printing

---

## 📋 Complete Setup Guide for EPSON ET-15000

### Step 1: Configure Windows Printer for Borderless Letter Printing

**IMPORTANT**: This is a ONE-TIME setup. Do this carefully!

1. **Open Printer Settings**
   - Go to **Control Panel** → **Devices and Printers**
   - Find **EPSONC5F6AA (ET-15000 Series)**
   - **Right-click** → **Printing Preferences** (NOT Properties!)

2. **Main Tab / Paper Tab**
   - **Paper Size**: Select **Letter (8.5 × 11 inches)** from dropdown
   - **Orientation**: Select **Landscape** (11" wide × 8.5" tall)
   - **Borderless**: ✅ **TURN ON** (This is critical!)
     - Look for "Borderless", "Edge-to-Edge", or "Expand to Fit"
     - May be under "Page Layout" or "More Options"
   - **Paper Type**: Select **Premium Matte** or **Heavyweight Matte**
     - Do NOT use "Plain Paper" or "Glossy"

3. **Layout Tab / 2-Sided Printing**
   - **2-Sided Printing**: ✅ **ON** / **Auto** / **Automatic**
   - **Binding Edge**: Select **Short Edge** (flip on short side)
   - **Reverse Order**: Usually leave OFF

4. **Quality Settings**
   - **Print Quality**: Select **Best** or **High** (NOT Draft)
   - **Color Mode**: Select **Color** (not Grayscale)
   - **Advanced Settings** (if available):
     - **DPI**: 300 DPI or higher
     - **Paper Thickness**: Thick or Cardstock

5. **Save Settings**
   - Click **Apply**
   - Click **OK**
   - These are now your DEFAULT settings

---

### Step 2: Verify Borderless is Working

**Quick Test Print:**

1. Open any image in Windows Photo Viewer or Paint
2. File → Print
3. Select your EPSON ET-15000
4. You should see:
   - ✅ "Borderless" checkbox is checked
   - ✅ Paper size shows "Letter"
   - ✅ Orientation is "Landscape"
5. Print a test page to confirm edges are printed without white borders

---

### Step 3: Use the App

Your app is now configured to use Letter size by default!

1. **Check Current Setting**
   - Go to **My Cards** / **Designs** page
   - Look at top-right for "Print Paper Size" dropdown
   - Should show **"Letter 11×8.5" (Auto-Duplex ✓)"**

2. **Print a Card**
   - Click **Print** on any card
   - Check browser console: Should show `Using print API: http://localhost:3001/print-pc`
   - Check backend console: Should show Letter size configuration

3. **Result**
   - PDF is generated at Letter size (11" × 8.5" landscape)
   - Card (8" × 6") is centered on the page
   - Borderless mode trims margins for edge-to-edge printing
   - Printer automatically flips and prints both sides
   - ONE beautiful double-sided card! 🎉

---

## 🎯 Understanding Letter Size Layout

### Your Card on Letter Paper

```
┌─────────────────────────────────────────────────┐
│                                                 │ ← 1.25" top margin
│     ┌───────────────────────────────┐         │
│     │                                 │         │
│1.5" │     YOUR 8" × 6" CARD          │ 1.5"   │
│     │     (CENTERED)                 │         │
│     │                                 │         │
│     └───────────────────────────────┘         │
│                                                 │ ← 1.25" bottom margin
└─────────────────────────────────────────────────┘
        11" wide × 8.5" tall (Landscape)
```

### With Borderless Printing

- **Borderless mode** extends the printed area to the edges
- The 8" × 6" card content fills more of the page
- No white borders on the final card
- Professional edge-to-edge printing

---

## 🐛 Troubleshooting

### Problem: "Borderless not available for this paper size"

**Solution**:
1. Make sure you selected **Letter** (8.5 × 11), not Letter (11 × 8.5)
2. Try selecting Letter first, THEN enable Borderless
3. Some EPSON models: Borderless only works in **Portrait** mode
   - If so, we need to adjust the PDF generation (let me know!)

### Problem: Still seeing white borders on printed cards

**Check**:
1. Is "Borderless" actually ON in printer preferences?
2. Windows Print Properties vs Printing Preferences are different!
   - Use **Printing Preferences** (the one that saves defaults)
3. Try printing a test photo from Windows to verify borderless works

### Problem: Card is off-center or cut off

**Check**:
1. Orientation must be **Landscape** (11" wide)
2. Paper loaded correctly in printer (wide edge at top)
3. Borderless mode may slightly expand the image - this is normal

### Problem: Duplex error

**Solution**:
1. Make sure 2-Sided Printing is set to **Short Edge** flip
2. EPSON ET-15000 requires **Letter**, **Legal**, or **A4** for duplex
3. Custom sizes do NOT support auto-duplex

### Problem: Print goes to wrong printer

**Check**:
1. Is local backend running? (`http://localhost:3001`)
2. Check browser console for print API URL
3. Verify printer name: `EPSONC5F6AA (ET-15000 Series)`

---

## 📐 Paper Specifications

### Recommended Paper

- **Size**: Letter (8.5 × 11 inches) - US Standard
- **Weight**: 200-300 GSM (heavyweight cardstock)
- **Finish**: Matte or Semi-Matte (NOT Glossy)
- **Type**: Cardstock or Premium Matte
- **Brand Examples**:
  - Neenah Classic Crest
  - Mohawk Via
  - Epson Premium Presentation Paper Matte

### Loading Paper

- **Tray**: Use Rear Paper Feeder (better for thick paper)
- **Orientation**: Landscape (11" wide edge at top)
- **Amount**: Don't overload - max 10-20 sheets of cardstock
- **Adjust guides**: Snug but not too tight

---

## 🎨 Print Quality Tips

### For Best Results

1. **Clean Print Heads**
   - Run printer head cleaning utility
   - Do this weekly if printing frequently

2. **Use Fresh Paper**
   - Cardstock can absorb moisture
   - Keep in sealed bag between uses

3. **Test Print First**
   - Always do a test on plain paper
   - Verify layout before using expensive cardstock

4. **Monitor Ink Levels**
   - EPSON ET-15000 has refillable tanks
   - Keep all colors topped up for best results

---

## ✅ Summary Checklist

Before your first print:

- [ ] Local backend is running (`npm run start` in backend folder)
- [ ] Printer preferences set to Letter + Landscape + Borderless + Duplex
- [ ] Heavyweight cardstock loaded in Rear Feeder
- [ ] Paper guides adjusted for Letter size
- [ ] App shows "Letter 11×8.5" (Auto-Duplex ✓)" selected
- [ ] Test print on plain paper first (optional but recommended)

---

## 🎉 You're Ready!

**Print your first card:**
1. Go to My Cards page
2. Click Print on any card
3. Wait for printer to flip and print both sides
4. Enjoy your beautiful borderless double-sided greeting card!

---

## 📝 Technical Details

### PDF Specifications

- **Page Size**: 11" × 8.5" (792 × 612 points) landscape
- **Card Content**: 8" × 6" (2400 × 1800 pixels at 300 DPI)
- **Positioning**: Centered on page
- **Margins**: 1.5" left/right, 1.25" top/bottom
- **Resolution**: 300 DPI (high quality)
- **Color Space**: RGB
- **Format**: Two pages (front/back) for auto-duplex

### What Happens When You Print

1. **Frontend** (your browser):
   - Converts 4 card images to base64
   - Sends to local backend at `http://localhost:3001/print-pc`
   - Includes `paperSize: 'letter'` parameter

2. **Backend** (Node.js):
   - Receives images
   - Creates two composite images:
     - Side 1: Back + Front (left + right)
     - Side 2: Inside Right + Inside Left
   - Generates PDF with Letter size (11" × 8.5")
   - Centers card content (8" × 6") on page
   - Sends PDF to printer via `pdf-to-printer` library

3. **Printer** (EPSON ET-15000):
   - Receives PDF print job
   - Applies Windows printer preferences:
     - Letter size
     - Landscape orientation
     - Borderless mode (expands to edges)
     - Auto-duplex (flip on short edge)
   - Prints Side 1
   - Flips paper automatically
   - Prints Side 2
   - Outputs finished card

4. **Result**:
   - Professional double-sided greeting card
   - Edge-to-edge printing (no white borders)
   - 4" × 6" when folded
   - Ready to give!

---

Need help? Check the backend console logs for detailed printing information!



