# Embedding Generation Guide

## ⚠️ Important Security Notice

Your previous API key was reported as leaked and has been blocked by Google. This happened because the API key was exposed in plain text files.

## Steps to Generate Embeddings

### 1. Get a New API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the new API key (keep it secure!)

### 2. Set the API Key as Environment Variable

**On Windows (PowerShell):**
```powershell
$env:GOOGLE_API_KEY="your_new_api_key_here"
```

**On Windows (Command Prompt):**
```cmd
set GOOGLE_API_KEY=your_new_api_key_here
```

**On Linux/Mac:**
```bash
export GOOGLE_API_KEY="your_new_api_key_here"
```

### 3. Run the Script

```bash
python scripts/generate_embeddings.py
```

## What the Script Does

1. **Scans Folders**: Recursively processes all subfolders in the Series directory
2. **Loads Data**: Reads `metadata.json` and `insidenote.json` from each folder
3. **Matches Cards**: Links records using the `filename` field
4. **Creates Text**: Combines card information into a single text block:
   - Title, Description, Occasion, Emotion
   - Recipient, Visible Text, Inside Note
   - Keywords, Style, Colors
5. **Generates Embeddings**: Calls Google Gemini API in batches (20 cards at a time)
6. **Saves Results**: Adds `embedding` field to each record in `insidenote.json`

## Expected Output

```
✅ Processed 8 folders
✅ Successfully added embeddings to 221 cards
```

## Security Best Practices

- ✅ **DO**: Use environment variables for API keys
- ✅ **DO**: Add `.env` files to `.gitignore`
- ✅ **DO**: Regenerate keys if they're exposed
- ❌ **DON'T**: Store API keys in code files
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Share API keys in screenshots or logs

## Troubleshooting

### Rate Limiting
If you hit rate limits, the script will automatically retry with exponential backoff.

### Missing Fields
Cards with missing required fields will be skipped and logged.

### API Errors
Check your API key is valid and has the Generative Language API enabled.

## File Structure

Each `insidenote.json` will be updated from:
```json
{
  "filename": "birthday (1).png",
  "inside_note": "May your special day be filled with..."
}
```

To:
```json
{
  "filename": "birthday (1).png",
  "inside_note": "May your special day be filled with...",
  "embedding": [0.128, -0.273, 0.412, ...]
}
```

## Script Features

- ✅ Batch processing for efficiency
- ✅ Exponential backoff on rate limits
- ✅ Progress logging
- ✅ Error handling and recovery
- ✅ Preserves existing JSON data
- ✅ Automatic retry on failures




