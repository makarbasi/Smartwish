# EPSON ET-15000 Print Setup Guide for Greeting Cards

## Overview
This guide helps you configure the EPSON ET-15000 printer for printing 4x6 inch folded greeting cards on 6x8 inch heavyweight paper with duplex (double-sided) printing.

---

## ⚙️ Automated Print Settings (Already Configured)

The following settings are automatically applied when you print:

- ✅ **Printer**: EPSONC5F6AA (ET-15000 Series)
- ✅ **Paper Size**: 6 x 8 inches
- ✅ **Duplex Printing**: Enabled (Front & Back on same sheet)
- ✅ **Color Printing**: Enabled
- ✅ **Scaling**: None (Actual Size - 100%)
- ✅ **Orientation**: Portrait

---

## 🖨️ Windows Printer Preferences Setup (ONE-TIME CONFIGURATION)

These settings need to be configured manually in Windows as they cannot be controlled programmatically:

### Step-by-Step Instructions:

1. **Open Printer Settings**
   - Press `Windows Key` + `R`
   - Type: `control printers`
   - Press Enter

2. **Access EPSON ET-15000 Preferences**
   - Find "EPSONC5F6AA (ET-15000 Series)"
   - Right-click → Select "Printing Preferences"

3. **Configure Main Settings Tab**
   - **Paper Source / Input Tray**: 
     - For **Heavyweight Cardstock**: `Rear Tray (Manual Feed)` ⭐ RECOMMENDED
     - For **Regular Paper**: `Auto Select` or `Tray 1 (Cassette)`
     - **Why Rear Tray?** Heavyweight paper feeds better through the straight rear path, reducing jams
   - **Orientation**: Portrait (or Landscape depending on paper size selected in app)

4. **Configure Paper/Quality Tab** ⭐ CRITICAL
   - **Paper Type**: 
     - Select: `Premium Matte` or `Heavyweight Matte`
     - Do NOT select: Glossy Photo Paper
     - Do NOT select: Plain Paper
   
   - **Print Quality**: 
     - Select: `Best` or `High Quality` or `Maximum`
     - Do NOT select: Draft or Standard
   
   - **Color Mode**: 
     - Select: `Color`

5. **Configure Layout/Advanced Tab**
   - **Paper Size**: 
     - If "6 x 8 in" is not available, select "User Defined"
     - Set Width: 6 inches (152.4 mm)
     - Set Height: 8 inches (203.2 mm)
   
   - **Two-Sided Printing/Duplex**: 
     - Enable: `Manual Duplex` or `Auto Duplex` (if supported)
     - Flip Style: `Flip on Long Edge` (for booklet style)

6. **Save as Default**
   - Click "Apply"
   - Click "OK"
   - These settings will now be the default for all print jobs

---

## 📋 Paper Specifications

- **Dimensions**: 6 x 8 inches (152.4 x 203.2 mm)
- **Type**: Heavyweight cardstock (NOT glossy)
- **Weight**: Typically 200-300 GSM
- **Finish**: Matte or Semi-matte
- **Result**: Creates 4 x 6 inch folded greeting cards

---

## 🎯 Printing Workflow

When you click "Print" in the application:

1. **Frontend**: 
   - Converts card images to base64
   - Sends images directly to backend `/print-pc` endpoint
   - **NO BROWSER POPUP** - completely automated!

2. **Backend**: 
   - Receives 4 card images
   - Creates composite images (front side + back side)
   - Generates PDF with proper 6x8 dimensions
   - **Sends directly to EPSON ET-15000 printer** using `pdf-to-printer` library

3. **Print System**: 
   - Prints to EPSON ET-15000 automatically
   - Applies 6x8 paper size
   - Enables duplex printing
   - Uses color mode
   - Applies quality settings from Windows preferences

4. **Result**: 
   - ✅ **NO Chrome/Browser print dialog** - prints silently in background
   - Page 1 prints on the FRONT of the paper
   - Page 2 prints on the BACK of the same paper
   - Final card is 4x6 inches when folded
   - You'll see an alert when the job is sent successfully

---

## 🐛 Troubleshooting

### Problem: Paper size not available
**Solution**: Create custom paper size
- In Printer Preferences → Advanced
- Click "Custom Paper Size"
- Name: "6x8 Greeting Card"
- Width: 6 in, Height: 8 in
- Save and select this size

### Problem: Print quality is low
**Solution**: 
- Verify "Print Quality" is set to "Best" or "High Quality"
- Check ink levels in EPSON ET-15000
- Ensure correct paper type is selected (Heavyweight Matte)

### Problem: Duplex not working
**Solution**:
- Some printers require manual duplex
- Print front side first
- Flip paper manually
- Resume printing for back side
- Or check if "Auto Duplex" is supported in printer driver

### Problem: Colors look wrong
**Solution**:
- Verify "Color Mode" is enabled (not grayscale)
- Check EPSON color management settings
- Ensure you're using the correct ICC profile for heavyweight paper

### Problem: Paper feeding issues
**Solution**:
- Use "Manual Feed" for specialty paper
- Ensure paper is properly aligned in tray
- Check that paper isn't too thick for auto-feed
- EPSON ET-15000 supports up to 300 GSM typically

---

## 📞 Additional Resources

- **EPSON ET-15000 Manual**: [EPSON Support Website](https://epson.com/support)
- **Driver Updates**: Ensure you have the latest EPSON ET-15000 driver
- **Paper Recommendations**: EPSON Premium Matte or similar heavyweight cardstock

---

## 🔄 When You're Ready for Production

When you've finished development and want to re-enable payment:

1. Open `smartwish-frontend/src/app/my-cards/page.tsx`
2. Find line ~732: Uncomment `setPaymentModalOpen(true);`
3. Remove or comment out the `executePrintDirect()` call
4. Repeat for `smartwish-frontend/src/app/my-cards/[id]/page.tsx` line ~896

---

## 📥 Printer Tray Selection Guide

### Which Tray Should I Use?

The EPSON ET-15000 has multiple paper trays. Choose based on your paper type:

#### For **Heavyweight Cardstock** (Recommended for Greeting Cards):
- **Use**: `Rear Tray (Manual Feed)` ⭐
- **Why?**: 
  - Straight paper path (no curves)
  - Less chance of jams with thick paper
  - Better for cardstock over 200 GSM
  - Manual feed allows you to insert one sheet at a time

#### For **Regular Paper** (Testing/Proofs):
- **Use**: `Auto Select` or `Tray 1 (Front Cassette)`
- **Why?**: 
  - Holds more sheets for batch printing
  - Automatic feeding
  - Good for lighter paper (under 200 GSM)

### How to Change the Tray:

1. **Open**: Control Panel → Devices and Printers
2. **Right-click**: "EPSONC5F6AA (ET-15000 Series)"
3. **Select**: "Printing Preferences"
4. **Go to**: "Main" or "Paper/Quality" tab
5. **Find**: "Paper Source" or "Input Tray" dropdown
6. **Select**: 
   - `Rear Tray` for cardstock
   - `Auto Select` for regular paper
   - `Tray 1 (Cassette)` for front tray
7. **Click**: Apply → OK

### 💡 Pro Tips:
- **Always test** with regular paper first before using expensive cardstock
- **Load heavyweight paper** one sheet at a time in rear tray
- **Fan cardstock** before loading to prevent sticking
- **Check paper guides** are snug against the paper edges

---

## 💡 Key Features

- ✅ **Silent Printing**: No browser print dialogs - prints directly via backend
- ✅ **Automatic Settings**: All print settings configured automatically
- ✅ **Duplex Support**: Front and back print on same paper automatically
- ✅ **6x8 Paper Size**: Custom paper size for greeting cards
- ✅ **Color & Quality**: High-quality color printing

---

**Version**: 2.0  
**Last Updated**: November 15, 2025  
**Printer**: EPSON ET-15000 Series (EPSONC5F6AA)  
**Card Size**: 4x6 folded (6x8 flat)  
**Print Method**: Direct backend printing via `pdf-to-printer` (NO browser dialog)

