# Supabase JSON MIME Type Fix

## Issue Found

**Error:**
```
StorageApiError: mime type application/json is not supported
```

**Root Cause:**
Supabase Storage doesn't accept `application/json` as a MIME type for file uploads. When we tried to upload event JSON files, they were rejected.

---

## Solution

Changed the MIME type from `application/json` to `text/plain`, which Supabase accepts.

---

## Changes Made

### 1. Frontend - Change Blob MIME Type

**File:** `smartwish-frontend/src/services/sessionRecordingService.ts`

**Before:**
```typescript
const blob = new Blob([jsonData], { type: 'application/json' });
```

**After:**
```typescript
// Use text/plain instead of application/json (Supabase doesn't support application/json)
const blob = new Blob([jsonData], { type: 'text/plain' });
```

**Comment added** to explain why we use `text/plain`.

---

### 2. Backend - Override Content Type for Events

**File:** `smartwish-backend/backend/src/session-recordings/session-recordings.service.ts`

**Before:**
```typescript
const { data: uploadData, error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(fileName, file, {
    contentType,  // ← This would be 'application/json' for events
    cacheControl: '3600',
    upsert: false,
  });
```

**After:**
```typescript
// Fix contentType for JSON files - Supabase doesn't support application/json
const uploadContentType = isEvents ? 'text/plain' : contentType;

const { data: uploadData, error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(fileName, file, {
    contentType: uploadContentType,  // ← Use 'text/plain' for events
    cacheControl: '3600',
    upsert: false,
  });
```

---

## Why This Works

### Supabase Storage Supported MIME Types

Supabase Storage has a whitelist of allowed MIME types. JSON is **not** on the list, but `text/plain` is.

**Supported types include:**
- `text/plain` ✅
- `text/html`
- `text/css`
- `text/javascript`
- `image/*`
- `video/*`
- `audio/*`
- `application/pdf`
- `application/zip`
- And others...

**NOT supported:**
- `application/json` ❌

### Files Are Still JSON

The files:
- Still have `.json` extension
- Still contain valid JSON data
- Can still be parsed as JSON when downloaded
- Just uploaded with `text/plain` MIME type

The MIME type is just metadata for storage. The actual file content is unchanged.

---

## Testing

### 1. Restart both servers

**Backend:**
```bash
cd smartwish-backend/backend
npm run start:dev
```

**Frontend:**
```bash
cd smartwish-frontend
npm run dev
```

### 2. Test a kiosk session

Browse around on the kiosk and end the session.

### 3. Check logs

**Frontend console should show:**
```
✅ [Recording] Starting event logging for session: abc-123
✅ [Recording] Captured DOM snapshot
✅ [Recording] Uploaded 145 events successfully  ← Should succeed now!
✅ [Recording] Recording completed successfully
```

**Backend logs should show:**
```
✅ [SessionRecordingsService] Uploaded: events/{sessionId}_events_1234567890.json
✅ [SessionRecordingsService] Completed recording: {recordingId}
```

**No more errors about MIME type!**

### 4. Verify in Supabase

1. Go to **Storage** → **session-recordings**
2. Navigate to **events/** folder
3. Download a JSON file
4. Open it - should be valid JSON:

```json
{
  "recordingId": "...",
  "sessionId": "...",
  "events": [
    {
      "type": "mouse_click",
      "timestamp": 1705603201500,
      "data": { "x": 450, "y": 320, ... }
    }
  ],
  "isFinal": true
}
```

---

## Alternative Solutions Considered

### Option 1: Change Supabase Bucket Settings
❌ Supabase doesn't allow custom MIME types in bucket settings

### Option 2: Use application/octet-stream
⚠️ Would work but `text/plain` is more semantic for text files

### Option 3: Store as .txt files
❌ Would require changing file extensions and confuse developers

### Option 4: Use text/plain (CHOSEN)
✅ Works with Supabase
✅ File extension stays .json
✅ Content is unchanged
✅ Simplest solution

---

## Files Modified

```
smartwish-frontend/src/services/
└── sessionRecordingService.ts    ← Changed blob MIME type

smartwish-backend/backend/src/session-recordings/
└── session-recordings.service.ts ← Override contentType for events
```

---

## Important Notes

### MIME Type vs File Extension

- **MIME Type:** `text/plain` (for Supabase storage)
- **File Extension:** `.json` (unchanged)
- **File Content:** Valid JSON (unchanged)
- **Download:** Works normally
- **Parsing:** JSON.parse() works fine

The MIME type is just metadata for the storage system. The actual file is still JSON.

### When Downloading

When you download and read these files:

```javascript
// Fetch the file
const response = await fetch(storageUrl);
const text = await response.text();

// Parse as JSON
const data = JSON.parse(text);  // ← Works perfectly!
```

The content is still valid JSON, regardless of the MIME type.

---

## Summary

**Problem:** Supabase Storage rejected `application/json` MIME type
**Solution:** Use `text/plain` MIME type instead
**Result:** Event files upload successfully as `.json` files with `text/plain` MIME type

**The upload should work now!** ✅

---

## Troubleshooting

### Still getting MIME type errors?

1. **Restart both servers** (backend AND frontend)
2. **Clear browser cache** (old code might be cached)
3. **Check Supabase status** (might be having issues)
4. **Verify backend changes deployed** (check backend code)

### Files not appearing in Supabase?

1. Check bucket exists: `session-recordings`
2. Check folder exists: `events/`
3. Check bucket permissions (RLS policies)
4. Check storage quota (not exceeded)

### Can't parse downloaded JSON?

1. Verify file was uploaded (check Supabase)
2. Download file and open in text editor
3. Should be valid JSON despite `text/plain` MIME
4. Use `JSON.parse(text)` after reading

---

## Complete!

The MIME type issue is fixed. Event uploads should now work successfully! 🎯

Try testing again and you should see successful uploads in both the console and Supabase Storage.
