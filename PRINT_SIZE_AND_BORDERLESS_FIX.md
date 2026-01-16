# Print Size & Borderless Fix ✅

## Issues Fixed

1. ✅ **Images too big** - Changed from 8.5x11 to 8x6 inches
2. ✅ **Wrong paper size** - Now correctly sized for 4x6 folded cards
3. ✅ **Borders showing** - Instructions for enabling borderless printing
4. ✅ **Paper orientation** - Clear guidance on landscape orientation

---

## 📐 New Dimensions

### Before (Wrong):
- **Paper**: 11 x 8.5 inches (Letter size landscape)
- **Result**: Images way too big!

### After (Correct):
- **Paper**: 8 x 6 inches LANDSCAPE
- **Each panel**: 4 x 6 inches
- **When folded**: Creates perfect 4x6 greeting card!
- **Resolution**: 300 DPI (high quality)

---

## 🖨️ Windows Printer Configuration (REQUIRED)

### Step-by-Step Instructions:

1. **Open Printer Settings**
   - Press `Windows Key + R`
   - Type: `control printers`
   - Press Enter

2. **Access EPSON ET-15000 Preferences**
   - Find "EPSONC5F6AA (ET-15000 Series)"
   - Right-click → "Printing Preferences"

3. **Main Tab / Paper Tab**
   - **Paper Size**: 
     - Look for "6 x 8 Borderless" or "6 x 8 in (Borderless)"
     - If not available, select "User Defined" and set:
       - Width: 8 inches
       - Height: 6 inches
       - Check "Borderless" option
   
   - **Orientation**: **LANDSCAPE** ⚠️ (Critical!)
     - 8 inches wide (horizontal)
     - 6 inches tall (vertical)
   
   - **Paper Type**: 
     - Premium Matte
     - OR Heavyweight Matte
     - NOT Plain Paper
     - NOT Glossy Photo Paper

4. **Quality Tab**
   - **Print Quality**: Best / High / Maximum
   - **Color**: Color (not grayscale)

5. **Layout Tab**
   - **Borderless**: ON ⚠️ (Critical!)
     - Enable "Borderless printing"
     - OR "Margin-free printing"
     - OR "Extend to edge"
   
   - **Duplex**: Manual or Auto Duplex
     - If manual: You'll flip paper yourself
     - If auto: Select "Flip on SHORT edge" (for landscape)

6. **Click Apply & OK**
   - These become your default settings

---

## 📄 How To Load Paper

### Paper Orientation: LANDSCAPE

```
┌─────────────────────────────┐
│         8 inches             │  ← Feed this edge into printer first
│    ┌──────────┬──────────┐  │
│    │  Panel 1 │  Panel 2 │  │
│    │   4x6    │   4x6    │  │  6 inches tall
│    │          │          │  │
│    └──────────┴──────────┘  │
└─────────────────────────────┘

Feed into printer →
```

**Loading Instructions:**
1. **Place paper in tray** in LANDSCAPE orientation
2. **8-inch edge goes into printer** first
3. **6-inch dimension** is the height
4. Make sure paper guides touch the edges

---

## 🎴 Card Layout Explanation

### Side 1 (Front):
```
┌───────────┬───────────┐
│   Back    │   Front   │ ← Prints on one side of paper
│  (Page 4) │ (Page 1)  │
└───────────┴───────────┘
```

### Side 2 (Back):
```
┌───────────┬───────────┐
│  Inside   │  Inside   │ ← Prints on other side (flipped)
│   Right   │   Left    │
│ (Page 2)  │ (Page 3)  │
└───────────┴───────────┘
```

### After Folding:
When you fold the paper in half, you get a perfect 4x6 greeting card!

---

## 🧪 Test Print Now

**No restart needed!** The changes to `print-card.js` take effect immediately.

Just click Print again from your frontend!

---

## ✅ Expected Results

### Backend Console:
```
═══════════════════════════════════════════════════════════════════════════════════
  🖨️  EPSON ET-15000 PRINT SETTINGS FOR 4x6 GREETING CARDS
═══════════════════════════════════════════════════════════════════════════════════
  PDF SETTINGS:
    ✓ Paper Size: 8 x 6 inches LANDSCAPE (for 4x6 folded cards)
    ✓ Resolution: 300 DPI (High Quality)
    ✓ Layout: Two 4x6 panels side-by-side

✅ Print job successfully sent via pdf-to-printer!
   📄 Paper: 8x6 inches LANDSCAPE (creates 4x6 folded card)
   🎨 Quality: 300 DPI High Resolution
   🖼️  Borderless: Must be enabled in Windows settings
```

### What You Should See:
- ✅ Images fit perfectly on the paper
- ✅ No white borders (if borderless is enabled)
- ✅ High quality 300 DPI print
- ✅ Two 4x6 panels side-by-side
- ✅ Ready to fold into 4x6 card

---

## 🐛 Troubleshooting

### Problem: Images still too big
**Solution**: 
- Verify Windows printer preferences show "8 x 6" or "6 x 8 Borderless"
- Make sure scaling is set to "Actual Size" or "100%"

### Problem: Still seeing borders
**Solution**:
- In EPSON printer preferences, find "Borderless" option
- It might be called:
  - "Borderless printing"
  - "Margin-free"
  - "Extend to edge"
  - "Full bleed"
- Enable it and apply

### Problem: Wrong orientation
**Solution**:
- Paper must be LANDSCAPE (8" wide, 6" tall)
- In printer preferences, select Landscape
- When loading paper, 8" edge goes into printer

### Problem: Duplex not working
**Solution**:
- Manual Duplex: Print page 1, flip paper, reinsert, print page 2
- Auto Duplex: Select "Flip on SHORT edge" for landscape
- Some printers need specific paper types for auto-duplex

---

## 📊 Files Modified

1. **`smartwish-backend/print-card.js`**
   - Lines 30-47: Updated dimensions from 11x8.5 to 8x6 inches
   - Lines 38-39: Panel size now 4x6 (1200x1800 px at 300 DPI)
   - Lines 42-43: Paper size now 8x6 (2400x1800 px)
   - Lines 46-47: PDF points now 576x432 (8x6 inches)
   - Lines 191-262: Updated printer instructions and console output

---

**Status:** ✅ READY TO TEST
**Paper Size:** 8 x 6 inches LANDSCAPE
**Card Size:** 4 x 6 inches (when folded)
**Resolution:** 300 DPI
**Borderless:** Configure in Windows

