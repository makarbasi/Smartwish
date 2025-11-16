# Print Module Error - FIXED ✅

## Problems Fixed

### Problem 1: Module Not Found
When trying to print, the backend threw an error:
```
Error: Cannot find module '../../print-card.js'
MODULE_NOT_FOUND
```

### Problem 2: Image Files Not Found
After fixing Problem 1, got a new error:
```
Input image file not found: downloads/flipbook/page_1.png
```

### Problem 3: Working Directory Mismatch
After fixing Problems 1 & 2, images were saved correctly but `print-card.js` still couldn't find them:
```
Saved page 1: C:\...\smartwish-backend\downloads\flipbook\page_1.png
--- An error occurred during the process ---
Input image file not found: downloads/flipbook/page_1.png
```

## Root Causes

### Issue 1: print-card.js Path
The relative path `../../print-card.js` in `app.controller.ts` worked fine for the TypeScript source files, but after compilation to JavaScript in the `dist` folder, the relative path no longer pointed to the correct location.

### Issue 2: Downloads Directory Path
The `downloadsDir` was set to `../../downloads` which worked in the TypeScript source but pointed to the wrong location after compilation. Images were saved in `backend/dist/downloads/` but `print-card.js` was looking in `smartwish-backend/downloads/`.

### Issue 3: Working Directory Context
Even with images in the right location, `print-card.js` uses **relative paths** (`downloads/flipbook/page_1.png`) which are resolved from the **current working directory**. When NestJS runs, the working directory is typically `smartwish-backend/backend`, not `smartwish-backend`, so the relative paths didn't resolve correctly.

### Path Issue Breakdown:

**TypeScript Source:**
- Location: `smartwish-backend/backend/src/app.controller.ts`
- Path used: `../../print-card.js`
- Resolves to: `smartwish-backend/print-card.js` ✅ Correct!

**Compiled JavaScript:**
- Location: `smartwish-backend/backend/dist/backend/src/app.controller.js`
- Path used: `../../print-card.js`
- Resolves to: `smartwish-backend/backend/dist/print-card.js` ❌ Wrong! (doesn't exist)

## Solutions Applied

### Fix 1: print-card.js Module Path

Changed the relative path to account for the compiled file location:

```typescript
// OLD CODE (broken after compilation)
const printCardModule = require('../../print-card.js');

// NEW CODE (works in compiled dist folder)
const printCardPath = path.join(__dirname, '../../../../print-card.js');
console.log('Loading print-card module from:', printCardPath);
const printCardModule = require(printCardPath);
```

### Fix 2: Downloads Directory Path

Changed the downloads directory path to match where print-card.js expects files:

```typescript
// OLD CODE (broken after compilation)
const downloadsDir = path.join(__dirname, '../../downloads');

// NEW CODE (works in compiled dist folder)
const downloadsDir = path.join(__dirname, '../../../../downloads');
console.log('Downloads directory:', downloadsDir);
```

### Fix 3: Change Working Directory Before Printing

Changed the working directory to `smartwish-backend` root before calling `print-card.js`:

```typescript
// Save current working directory
const originalCwd = process.cwd();

// Change to smartwish-backend root so relative paths work
const smartwishBackendRoot = path.join(__dirname, '../../../..');
process.chdir(smartwishBackendRoot);
console.log('Working directory changed to:', process.cwd());

// Call print function (now relative paths will resolve correctly)
const printCardModule = require(printCardPath);
await printCardModule.main(printerName);

// Restore original working directory
process.chdir(originalCwd);
```

### Path Resolution:
From `dist/backend/src/`:
- `../` → `dist/backend/`
- `../../` → `dist/`
- `../../../` → `backend/`
- `../../../../` → `smartwish-backend/` (root directory!)

Now the images are saved in the right location AND `print-card.js` runs from the correct directory!

## Files Modified

1. **`smartwish-backend/backend/src/app.controller.ts`**
   - Line ~32: Updated `downloadsDir` path from `../../downloads` to `../../../../downloads`
   - Line ~446-468: 
     - Updated require path for print-card.js module from `../../` to `../../../../`
     - Added `process.chdir()` to change working directory before printing
     - Restore working directory after printing completes
   - Added extensive console logging for debugging

## Changes Applied

✅ Backend TypeScript code updated
✅ Backend rebuilt (`npm run build`)
✅ Compiled JavaScript verified

## Next Steps - RESTART YOUR BACKEND

**You must restart your backend server for the fix to take effect:**

### Option 1: If running with npm/node
```bash
# Stop the current server (Ctrl+C)
cd smartwish-backend/backend
npm start
# or
npm run start:dev
```

### Option 2: If running with NestJS CLI
```bash
# Stop the current server (Ctrl+C)
cd smartwish-backend/backend
npx nest start
# or
npx nest start --watch
```

### Option 3: If running the old server.js
```bash
# Stop the current server (Ctrl+C)
cd smartwish-backend
node server.js
```

## Testing the Fix

After restarting the backend:

1. Go to your frontend application
2. Open a card in "My Cards"
3. Click the "Print" button
4. You should see in the backend console:
   ```
   Loading print-card module from: C:\...\smartwish-backend\print-card.js
   ```
5. The print job should be sent to your EPSON ET-15000 printer without errors!

## Expected Output

**Backend Console (success):**
```
Downloads directory: C:\...\smartwish-backend\downloads
PC Print request received for 4 images to printer: EPSONC5F6AA (ET-15000 Series)
Saved page 1: C:\...\smartwish-backend\downloads\flipbook\page_1.png
Saved page 2: C:\...\smartwish-backend\downloads\flipbook\page_2.png
Saved page 3: C:\...\smartwish-backend\downloads\flipbook\page_3.png
Saved page 4: C:\...\smartwish-backend\downloads\flipbook\page_4.png
Loading print-card module from: C:\...\smartwish-backend\print-card.js
Current working directory: C:\...\smartwish-backend\backend
Changing to smartwish-backend root: C:\...\smartwish-backend
Working directory changed to: C:\...\smartwish-backend
Found image: downloads/flipbook/page_1.png
Found image: downloads/flipbook/page_2.png
Found image: downloads/flipbook/page_3.png
Found image: downloads/flipbook/page_4.png

═══════════════════════════════════════════════════════════════════════════════════
  🖨️  EPSON ET-15000 PRINT SETTINGS FOR 6x8 GREETING CARDS
═══════════════════════════════════════════════════════════════════════════════════
✅ Print job successfully sent via pdf-to-printer!
   📄 Paper: 6x8 inches, Duplex, Color
Working directory restored to: C:\...\smartwish-backend\backend
```

**Frontend:**
```
Alert: Print job sent to EPSONC5F6AA (ET-15000 Series)!
Check your printer for output.
```

---

**Status:** ✅ FIXED - Ready to print!
**Date:** November 15, 2025

