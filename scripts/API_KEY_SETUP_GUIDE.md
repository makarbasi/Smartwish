# Google API Key Setup Guide for Gemini Embeddings

## The Problem

You're getting: `400 API key expired. Please renew the API key.`

This error message is misleading - it usually means the **Generative Language API is not enabled**, not that the key is actually expired.

## ✅ SOLUTION: Use Google AI Studio (Recommended)

### Option 1: Get API Key from Google AI Studio (EASIEST)

1. **Go to Google AI Studio:**
   - Visit: https://aistudio.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key:**
   - Click **"Get API key"** or **"Create API key"**
   - Choose **"Create API key in new project"** (recommended)
   - Copy the generated API key

3. **Test the key immediately:**
   - The key should work immediately for the Gemini API
   - No additional setup needed!

### Option 2: Enable API in Google Cloud Console (Alternative)

If you prefer using Google Cloud Console:

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/

2. **Select or Create a Project:**
   - Click the project dropdown at the top
   - Select existing project or create a new one

3. **Enable Generative Language API:**
   - Visit: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Click **"ENABLE"**
   - Wait for activation (can take 1-2 minutes)

4. **Create API Key:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click **"Create Credentials"** → **"API Key"**
   - Copy the generated key

5. **Configure API Key (Optional but recommended):**
   - Click "Edit API key"
   - Under "API restrictions", select "Restrict key"
   - Check only: **"Generative Language API"**
   - Save

## 🧪 Test Your New API Key

After getting a new key:

1. **Set the environment variable:**
   ```powershell
   $env:GOOGLE_API_KEY = "your_new_api_key_here"
   ```

2. **Run the test script:**
   ```powershell
   python scripts/test_api_key.py
   ```

3. **Expected output:**
   ```
   ✓ API Key found (length: 39)
   ✓ API configured successfully
   ✓ Found models
   ✓ Successfully generated embedding!
   ✅ ALL TESTS PASSED!
   ```

## 🚀 Run the Embedding Generator

Once the test passes:

1. **Option A: Using PowerShell script (edit the API key in the file first):**
   ```powershell
   # Edit scripts/run_embeddings.ps1 to add your API key
   .\scripts\run_embeddings.ps1
   ```

2. **Option B: Set env var then run:**
   ```powershell
   $env:GOOGLE_API_KEY = "your_api_key_here"
   python scripts/generate_embeddings.py
   ```

## ⚠️ Common Issues & Solutions

### Issue 1: "API key expired" (even with new key)
**Solution:** Make sure you're using a key from Google AI Studio (https://aistudio.google.com/app/apikey) not Google Cloud Console, OR ensure the Generative Language API is enabled.

### Issue 2: "API key not valid"
**Solution:** 
- Check for extra spaces when copying/pasting
- Make sure the key starts with `AIza`
- Key should be exactly 39 characters

### Issue 3: Rate limiting
**Solution:** The script has automatic retry with exponential backoff. Just wait, it will recover.

### Issue 4: Different error with API restrictions
**Solution:** Remove API restrictions or ensure "Generative Language API" is in the allowed list.

## 🔒 Security Reminder

- ✅ **DO**: Use environment variables
- ✅ **DO**: Delete old/leaked keys from Google Console
- ✅ **DO**: Add API restrictions to limit usage
- ❌ **DON'T**: Commit API keys to git
- ❌ **DON'T**: Share keys in screenshots

## 📊 Expected Results

Once working, the script will process:
- 8 folders
- ~221 greeting cards
- Generate 768-dimensional embeddings for each
- Save to `insidenote.json` files
- Complete in ~5-10 minutes





