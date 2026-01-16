# ✅ AUTO-DUPLEX SOLUTION: Using 8×10 Paper

## 🎯 The Solution

Since EPSON ET-15000 doesn't support automatic duplex on custom 8×6 size, I've changed to **8×10 STANDARD paper size** which DOES support auto-duplex!

---

## 📐 How It Works

### PDF Layout:
```
┌─────────────────────────────────┐
│        2 inch margin            │ ← Trim this after printing
├─────────────────────────────────┤
│   ┌──────────┬──────────┐      │
│   │   Back   │  Front   │      │  8 x 6
│   │   4x6    │   4x6    │      │  Card
│   │          │          │      │  Content
│   └──────────┴──────────┘      │
├─────────────────────────────────┤
│        2 inch margin            │ ← Trim this after printing
└─────────────────────────────────┘
     8 inches wide × 10 inches tall
```

### Result:
- ✅ **Printer auto-flips** and prints both sides
- ✅ **Card content**: Perfect 8×6 inches
- ✅ **Extra space**: 2" top + 2" bottom = easy to trim
- ✅ **Final card**: 4×6 when folded

---

## 🖨️ Windows Printer Settings (UPDATED)

### What You Need to Set:

1. **Open Printer Preferences**
   - Control Panel → Devices and Printers
   - Right-click "EPSONC5F6AA (ET-15000 Series)"
   - Click "Printing Preferences"

2. **Main/Paper Tab**
   - **Paper Size**: **8 x 10 in** (standard photo size - already in dropdown!)
   - **Orientation**: **Landscape**
   - **Paper Type**: Premium Matte or Heavyweight Matte

3. **Layout/Finishing Tab**
   - **Two-Sided Printing**: **ON** ✅
   - **Duplex**: **Automatic**
   - **Flip on**: **Short Edge** (for landscape orientation)

4. **Quality Tab**
   - **Print Quality**: Best / High Quality / Maximum

5. **Click Apply & OK**

---

## 📄 Paper Loading

### Use 8×10 Paper:
- Standard photo paper size
- Available at any store (Staples, Amazon, etc.)
- Load in **LANDSCAPE** orientation (8" wide)
- Feed 8" edge into printer first

---

## ✂️ After Printing

Your card will print with extra margins:

1. **Wait for duplex printing** to complete (both sides)
2. **Trim 2 inches** from the top
3. **Trim 2 inches** from the bottom
4. **Final size**: 8 × 6 inches
5. **Fold in half**: Perfect 4 × 6 inch greeting card!

You can use:
- Paper trimmer/guillotine
- Ruler + X-Acto knife
- Scissors with ruler guide

---

## 🧪 Test Now

**No restart needed!** Changes take effect immediately.

### Steps:

1. **Configure Windows printer**:
   - Paper size: 8 × 10 in
   - Duplex: ON (flip on short edge)
   - Orientation: Landscape

2. **Load 8×10 paper** in printer tray

3. **Print from your app**

4. **Watch it automatically duplex!** 🎉

---

## ✅ What Changed in Code

**File**: `smartwish-backend/print-card.js`

### Before:
```javascript
// 8×6 custom size (no duplex support)
const paperWidthPoints = 8 * 72;  // 576 points
const paperHeightPoints = 6 * 72; // 432 points
```

### After:
```javascript
// 8×10 standard size (duplex supported!)
const paperWidthPoints = 8 * 72;   // 576 points (8 inches)
const paperHeightPoints = 10 * 72; // 720 points (10 inches)

// Card content centered with 2" margins
const verticalOffsetPx = (paperHeightPx - cardContentHeightPx) / 2;
```

---

## 📊 Comparison

| Feature | 8×6 Custom | 8×10 Standard |
|---------|------------|---------------|
| **Duplex Support** | ❌ No | ✅ Yes |
| **Manual Flip** | Required | Not needed |
| **Paper Availability** | Custom order | Standard/Common |
| **Trimming Required** | No | Yes (2" top/bottom) |
| **Final Result** | 4×6 card | 4×6 card |

---

## 🎉 Benefits

1. ✅ **Automatic duplex** - No manual flipping!
2. ✅ **Standard paper size** - Easy to buy
3. ✅ **Works immediately** - No custom size configuration
4. ✅ **Same quality** - 300 DPI high resolution
5. ✅ **Same result** - Perfect 4×6 folded card

The only trade-off is trimming 2" margins, which is quick and easy!

---

## 🐛 Troubleshooting

### "Two-Sided Printing option is grayed out"
- **Fix**: Change Paper Type to Premium Matte or Photo Paper
- Plain Paper often doesn't support duplex

### "Printer still says paper not available for duplex"
- **Fix**: Make sure you selected **"8 x 10 in"** (standard)
- Not "User Defined" or custom size

### "Images are offset vertically"
- **This is correct!** - 2" margins top/bottom are intentional
- Just trim them after printing

### "Duplex prints on wrong side"
- **Fix**: Change flip option from "Long Edge" to **"Short Edge"**
- This is because we're using Landscape orientation

---

**Status**: ✅ READY TO PRINT WITH AUTO-DUPLEX!

**Paper**: 8 × 10 inches STANDARD

**Duplex**: AUTOMATIC

**Trimming**: 2 inches top & bottom after printing

