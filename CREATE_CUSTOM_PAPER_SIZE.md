# How to Create Custom 8x6 Paper Size for EPSON ET-15000

## Method 1: EPSON Printer Driver (Recommended)

### Step-by-Step:

1. **Open Printer Properties**
   - Press `Windows Key + R`
   - Type: `control printers`
   - Find "EPSONC5F6AA (ET-15000 Series)"
   - Right-click → **"Printing Preferences"** (NOT Properties)

2. **Access Custom Paper Size**
   - Click on **"Main"** or **"Paper"** tab
   - Look for **"Paper Size"** dropdown
   - Scroll down to find **"User Defined"** or **"Custom"**
   - Click on it

3. **Set Custom Size**
   - A dialog should pop up
   - **Name**: "8x6 Greeting Card"
   - **Paper Width**: 8.00 inches (or 203.2 mm)
   - **Paper Height**: 6.00 inches (or 152.4 mm)
   - **Unit**: Inches
   - Click **"Save"** or **"OK"**

4. **Enable Borderless (Critical!)**
   - In the same Main/Paper tab
   - Look for checkbox: **"Borderless"** or **"Borderless Printing"**
   - ☑️ Check it
   - If prompted, select **"Expand to fit"** or **"Retain Size"**

5. **Set Other Options**
   - **Orientation**: Landscape
   - **Paper Type**: Premium Matte or Heavyweight Matte
   - **Print Quality**: Best / High Quality / Maximum
   - **Paper Source**: Manual Feed (recommended for heavyweight paper)

6. **Apply & Save**
   - Click **"Apply"**
   - Click **"OK"**

---

## Method 2: Windows System (If Method 1 Doesn't Work)

### For Windows 10/11:

1. **Open Devices and Printers**
   - `Windows Key + R`
   - Type: `control printers`
   - Press Enter

2. **Open Printer Server Properties**
   - Click **any printer** in the window
   - At the top menu bar, click **"Print server properties"**
   - (If you don't see this, click "File" → "Server Properties")

3. **Create Custom Form**
   - Go to **"Forms"** tab
   - ☑️ Check **"Create a new form"**
   - **Form name**: Type "8x6 Greeting Card"
   
4. **Set Dimensions**
   - **Units**: Select "English" (Inches)
   - **Paper Size:**
     - Width: **8.00** inches
     - Height: **6.00** inches
   - **Printer area margins:** (Set all to 0.00 for borderless)
     - Left: 0.00
     - Right: 0.00
     - Top: 0.00
     - Bottom: 0.00

5. **Save the Form**
   - Click **"Save Form"**
   - Click **"OK"** to close

6. **Use the New Size**
   - Go back to your EPSON printer
   - Right-click → "Printing Preferences"
   - In Paper Size dropdown, you should now see "8x6 Greeting Card"
   - Select it

---

## Method 3: Use 6x8 Instead (Easier Alternative)

If custom sizes are problematic, use **6x8** in **Portrait** orientation:

1. **In Printer Preferences:**
   - Paper Size: **"6 x 8 in"** (standard photo size)
   - Orientation: **Portrait**
   - Enable: **"Borderless"** or **"6 x 8 in (Borderless)"**

2. **Load Paper:**
   - Put 6x8 paper in PORTRAIT orientation
   - 6" edge feeds into printer first
   - 8" is the height

> **Note**: This is the same physical result as 8x6 landscape - just rotated 90 degrees!

---

## 📸 What to Look For

### EPSON Printer Preferences Window:

```
┌─────────────────────────────────────────┐
│ Main  Quality  Layout  Maintenance      │
├─────────────────────────────────────────┤
│ Paper Size: [User Defined          ▼]  │ ← Look here
│                                          │
│ ☐ Borderless                            │ ← Check this!
│                                          │
│ Orientation:                             │
│  ○ Portrait  ● Landscape                │ ← Select Landscape
│                                          │
│ Paper Type: [Premium Matte          ▼] │
│                                          │
│ Print Quality: [Best               ▼]  │
└─────────────────────────────────────────┘
```

### User Defined Size Dialog:

```
┌────────────────────────────────┐
│  User Defined Paper Size       │
├────────────────────────────────┤
│  Paper Size Name:               │
│  [8x6 Greeting Card         ]  │
│                                 │
│  Paper Width:  [8.00] inches    │
│  Paper Height: [6.00] inches    │
│                                 │
│  [ Save ]  [ Cancel ]          │
└────────────────────────────────┘
```

---

## 🧪 Test the Custom Size

After creating the custom size:

1. Go back to printer preferences
2. Select your "8x6 Greeting Card" size
3. Enable Borderless
4. Set to Landscape
5. Click Apply
6. Try printing again from your app!

---

## 🐛 Troubleshooting

### "User Defined" is grayed out
- Your EPSON driver may need updating
- Try Method 2 (Windows System) instead
- Or use Method 3 (6x8 portrait)

### Can't save custom size
- Run as Administrator:
  - Search "Devices and Printers" in Start Menu
  - Right-click → "Run as administrator"
  - Try again

### Borderless option not available
- Not all paper types support borderless
- Try changing Paper Type to:
  - Premium Matte
  - Premium Glossy Photo Paper
  - Photo Paper
- Plain Paper usually doesn't support borderless

### Size doesn't appear after creating
- Close and reopen printer preferences
- Restart the Print Spooler service:
  ```
  Windows Key + R → services.msc
  Find "Print Spooler" → Right-click → Restart
  ```

---

## ✅ Quick Summary

**Option A (Best)**: Create "8x6 Greeting Card" custom size, Landscape, Borderless

**Option B (Easier)**: Use "6 x 8 in Borderless", Portrait orientation

Both achieve the same result - a borderless 4x6 folded greeting card!

---

**Need help? Let me know which method you're trying and where you're stuck!**

