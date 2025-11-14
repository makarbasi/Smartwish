# 🚀 Quick Start Guide - Generate Embeddings

## Your Issue: "API key expired"

The error you're getting means the **Generative Language API is not enabled** for your API key. This is a misleading error message from Google.

## ✅ SOLUTION (3 Simple Steps)

### Step 1: Get a NEW API Key from Google AI Studio

**This is the key difference!** Don't use Google Cloud Console. Use Google AI Studio instead:

1. Go to: **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API key"** or **"Get API key"**
4. Choose **"Create API key in new project"**
5. **Copy the key immediately** (it looks like: `AIzaSy...`)

### Step 2: Test Your API Key

Edit `scripts/run_test.ps1` and replace `REPLACE_WITH_YOUR_API_KEY` with your new key:

```powershell
# Edit line 5 in scripts/run_test.ps1
$API_KEY = "AIzaSyYourActualKeyHere..."
```

Then run:

```powershell
.\scripts\run_test.ps1
```

**Expected output:**
```
✓ API Key found
✓ API configured successfully
✓ Found models
✓ Successfully generated embedding!
✅ ALL TESTS PASSED!
```

### Step 3: Generate Embeddings

Edit `scripts/run_embeddings.ps1` and add the same API key:

```powershell
# Edit line 5 in scripts/run_embeddings.ps1
$API_KEY = "AIzaSyYourActualKeyHere..."
```

Then run:

```powershell
.\scripts\run_embeddings.ps1
```

**Expected output:**
```
✅ Processed 8 folders
✅ Successfully added embeddings to 221 cards
```

---

## 🔧 Alternative: Using Batch Files

If PowerShell doesn't work, use the `.bat` versions:

1. Edit `scripts/run_embeddings.bat` (add your API key)
2. Run: `scripts\run_embeddings.bat`

---

## ❌ Common Mistakes

### ❌ Using Google Cloud Console API Keys
- These require additional setup (enabling APIs, billing, etc.)
- Use Google AI Studio instead: https://aistudio.google.com/app/apikey

### ❌ Not Creating a New Project
- When creating the key, choose "Create API key in **new project**"
- This ensures all APIs are enabled automatically

### ❌ Copy-Paste Errors
- Make sure no extra spaces before/after the key
- Key should be exactly 39 characters
- Should start with `AIza`

---

## 📁 What Gets Modified

The script will add `"embedding"` fields to all `insidenote.json` files:

**Before:**
```json
{
  "filename": "birthday (1).png",
  "inside_note": "May your special day be filled with..."
}
```

**After:**
```json
{
  "filename": "birthday (1).png",
  "inside_note": "May your special day be filled with...",
  "embedding": [0.0123, -0.0456, 0.0789, ...]
}
```

---

## 🆘 Still Having Issues?

### Check API Key Format
```powershell
# Should print exactly 39
$API_KEY.Length
```

### Manually Test in PowerShell
```powershell
$env:GOOGLE_API_KEY = "YourAPIKeyHere"
python scripts/test_api_key.py
```

### Read Detailed Guide
See `API_KEY_SETUP_GUIDE.md` for comprehensive troubleshooting.

---

## 📊 Processing Details

- **Folders:** 8 (Birthday, Christmas, Congratulations, etc.)
- **Cards:** ~221 total
- **Batch Size:** 20 cards per API call
- **Embedding Model:** `models/embedding-001`
- **Vector Dimension:** 768
- **Estimated Time:** 5-10 minutes

---

## ✨ After Success

Your `insidenote.json` files will have embeddings ready for:
- Semantic search
- Similarity matching
- Recommendation systems
- Card discovery features

Happy embedding! 🎉



