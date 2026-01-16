# EPSON ET-15000 Duplex Printing Fix

## ⚠️ Problem: "Selected paper is not available for 2 sided printing"

**Root Cause**: EPSON ET-15000 does **NOT** support auto-duplex on Half Letter (Statement) size, even though it's a standard paper size.

## ✅ Solution: Use Letter Size Instead

Your card (8" × 6") fits perfectly on Letter size (11" × 8.5") with nice margins!

---

## 📋 Step-by-Step Setup

### Step 1: Configure Windows Printer Settings

**IMPORTANT**: You must set up duplex settings for Letter size in Windows printer preferences first!

1. Open **Control Panel** → **Devices and Printers**
2. Right-click **EPSONC5F6AA (ET-15000 Series)**
3. Click **Printing Preferences**
4. Configure these settings:

   **Main/Paper Tab:**
   - **Paper Size**: ✅ **Letter (8.5 × 11 inches)** ← SELECT THIS FROM DROPDOWN
   - **Orientation**: ✅ **Landscape** (11" wide × 8.5" tall)
   - **Paper Type**: ✅ **Heavyweight Paper** or **Premium Matte**
   - **Borderless**: ✅ **ON** (recommended for cards)

   **Layout Tab (or 2-Sided Printing):**
   - **2-Sided Printing**: ✅ **ON** / **Auto**
   - **Binding Edge**: ✅ **Short Edge** (flip on short side)
   
   **Quality Tab:**
   - **Print Quality**: ✅ **Best** or **High**
   - **Color Mode**: ✅ **Color**

5. Click **Apply** → **OK**

### Step 2: Select Letter Size in Your App

1. Go to your **Designs** page (My Cards)
2. Look at the top-right corner for "Print Paper Size" dropdown
3. Select **"Letter 11×8.5" (Auto-Duplex ✓)"**

You should see:
```
✓ Auto-duplex supported - printer will flip automatically
```

### Step 3: Load Paper Correctly

- Use **Letter size paper** (8.5 × 11 inches)
- Load in **LANDSCAPE orientation** (11" wide edge at top)
- Use **heavyweight cardstock** (200-300 GSM, NOT glossy)
- **Matte or Semi-matte finish** works best

### Step 4: Print Your Card

1. Click **Print** button
2. The printer will:
   - Print Side 1 (Back + Front panels) on the first pass
   - **Automatically flip the paper**
   - Print Side 2 (Inside panels) on the second pass
3. **Result**: ONE perfectly centered double-sided card! 🎉

---

## 📐 Why Letter Size is Better

| Feature | Letter Size | Half Letter |
|---------|------------|-------------|
| Paper Dimensions | 11" × 8.5" | 8.5" × 5.5" |
| Card Dimensions | 8" × 6" | 8" × 6" |
| Auto-Duplex | ✅ **WORKS** | ❌ Not supported by EPSON |
| Side Margins | 1.5" each side | 0.25" each side |
| Top/Bottom Margins | 1.25" each | **OVERFLOW** (card too tall) |
| Trimming Required | ✅ **NO** | ⚠️ Yes (0.25" each) |
| Professional Look | ✅ Centered with margins | Tight fit |

**Conclusion**: Letter size is the **correct choice** for EPSON ET-15000!

---

## 🐛 Troubleshooting

### Still getting duplex error?

**Double-check Windows settings:**
1. Go to **Control Panel** → **Devices and Printers**
2. Right-click **EPSONC5F6AA (ET-15000 Series)**
3. Click **Printing Preferences** (NOT Properties)
4. Verify:
   - Paper Size = **Letter** (not Custom, not Statement)
   - 2-Sided Printing = **ON**
   - Binding Edge = **Short Edge**

### Print job goes to printer but nothing happens?

**Check physical printer:**
1. Is the printer **online** and ready?
2. Is there enough **heavyweight cardstock** loaded?
3. Check **Windows Print Queue** for stuck jobs
4. Try a **test print** from Windows (Print Test Page)

### Card prints but not centered?

**This is normal and correct!**
- The card (8" × 6") is centered on Letter paper (11" × 8.5")
- There will be **1.5" margins** on the sides
- There will be **1.25" margins** on top/bottom
- You can trim the margins if desired

---

## 🎯 Supported EPSON ET-15000 Duplex Sizes

| Paper Size | Auto-Duplex Support | Recommended for Cards |
|-----------|-------------------|----------------------|
| Letter (8.5 × 11) | ✅ YES | ✅ **BEST CHOICE** |
| Legal (8.5 × 14) | ✅ YES | ⚠️ Too large |
| A4 (210 × 297 mm) | ✅ YES | ⚠️ Metric size |
| Statement/Half Letter | ❌ **NO** | ❌ **DON'T USE** |
| Custom sizes | ❌ NO | ❌ Manual only |

---

## 📝 Summary

1. ❌ **Don't use Half Letter** - EPSON ET-15000 doesn't support duplex on this size
2. ✅ **Use Letter size** - Fully supported, looks professional with margins
3. ⚙️ **Configure Windows printer** preferences for Letter + Duplex + Short Edge
4. 🖨️ **Select Letter in the app** dropdown before printing

---

## 🎉 You're All Set!

Now try printing a card with Letter size - it will work perfectly with double-sided printing!



