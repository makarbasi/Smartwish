# Final MIME Type Fix - Let Supabase Auto-Detect

## Issue

Supabase Storage was rejecting various MIME types:
- ❌ `application/json` - Not supported
- ❌ `text/plain` - Not supported  
- ❌ `application/octet-stream` - May not be supported

## Root Cause

Supabase Storage has a whitelist of allowed MIME types, and we were trying to force MIME types that aren't on the list.

## Solution

**Don't specify a MIME type at all** - let Supabase auto-detect based on the `.json` file extension.

---

## Changes Made

### 1. Backend - Remove contentType for JSON Files

**File:** `smartwish-backend/backend/src/session-recordings/session-recordings.service.ts`

**Before:**
```typescript
const uploadContentType = isEvents ? 'application/octet-stream' : contentType;

const { data: uploadData, error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(fileName, file, {
    contentType: uploadContentType,  // ← Explicitly setting MIME type
    cacheControl: '3600',
    upsert: false,
  });
```

**After:**
```typescript
// For events (JSON files), don't specify contentType - let Supabase infer from .json extension
const uploadOptions: any = {
  cacheControl: '3600',
  upsert: false,
};

// Only set contentType for video/thumbnail, let JSON files be auto-detected
if (!isEvents) {
  uploadOptions.contentType = contentType;
}

const { data: uploadData, error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(fileName, file, uploadOptions);  // ← No contentType for JSON
```

**Logic:**
- For videos/thumbnails: Use the uploaded file's MIME type
- For JSON events: Don't set contentType, let Supabase detect from `.json` extension

### 2. Frontend - Remove MIME Type from Blob

**File:** `smartwish-frontend/src/services/sessionRecordingService.ts`

**Before:**
```typescript
const blob = new Blob([jsonData], { type: 'application/octet-stream' });
```

**After:**
```typescript
// Don't specify MIME type - let the backend/Supabase infer from .json extension
const blob = new Blob([jsonData]);
```

---

## Why This Works

### File Extension Detection

Supabase Storage can automatically detect MIME types based on file extensions:

| Extension | Auto-Detected Type |
|-----------|-------------------|
| `.json` | Appropriate JSON type |
| `.jpg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webm` | `video/webm` |
| `.mp4` | `video/mp4` |

By using `.json` extension and not forcing a MIME type, Supabase will detect and use an appropriate type.

### Simpler Architecture

```
Frontend
  ↓ Blob (no MIME type)
Next.js API
  ↓ FormData with .json filename
Backend
  ↓ Upload to Supabase (no contentType specified for JSON)
Supabase
  ↓ Auto-detects from .json extension ✅
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (Browser)                      │
│  sessionRecordingService.ts                              │
│  ↓ Blob (no MIME type)                                   │
│  ↓ FormData { file: blob, fileName: "...json" }         │
└────────────────────────┬────────────────────────────────┘
                         ↓
                    fetch('/api/kiosk/session/recording/upload')
                         ↓
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTE (Proxy)                   │
│  /app/api/kiosk/session/recording/upload/route.ts       │
│  ↓ Forward FormData to backend                           │
└────────────────────────┬────────────────────────────────┘
                         ↓
                    fetch('BACKEND_URL/kiosk/session/recording/upload')
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 BACKEND (NestJS)                         │
│  session-recordings.service.ts                           │
│  ↓ Don't set contentType for JSON files                  │
│  ↓ supabase.storage.upload(fileName, file, {...})       │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 SUPABASE STORAGE                         │
│  ↓ Auto-detect MIME type from .json extension ✅        │
│  ↓ Store in: session-recordings/events/*.json           │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ Frontend NEVER talks directly to Supabase
- ✅ Everything goes through Next.js API → Backend → Supabase
- ✅ No MIME type forced for JSON files
- ✅ Supabase auto-detects from file extension

---

## Testing

### 1. Restart Backend
```bash
cd smartwish-backend/backend
# Stop with Ctrl+C if running
npm run start:dev
```

### 2. Test Upload

Browse a kiosk session and end it.

**Expected Frontend Console:**
```
✅ [Recording] Starting event logging for session: abc-123
✅ [Recording] Captured DOM snapshot
✅ [Recording] Uploaded 145 events successfully
✅ [Recording] Recording completed successfully
```

**Expected Backend Logs:**
```
✅ [SessionRecordingsService] Uploaded: events/{sessionId}_events_123.json
✅ [SessionRecordingsService] Completed recording: {recordingId}
```

**No MIME type errors!**

### 3. Verify in Supabase

1. Go to **Storage** → **session-recordings**
2. Navigate to **events/** folder
3. You should see JSON files
4. Click to download/view - should be valid JSON

---

## What If It Still Fails?

### Check Bucket Settings

If auto-detection still fails, check your Supabase bucket configuration:

1. Go to **Supabase Dashboard**
2. Navigate to **Storage**
3. Click on **session-recordings** bucket
4. Check **Settings** → **Allowed MIME types**

**If there's a whitelist**, you may need to add allowed types or disable the whitelist.

### Alternative: Use Database Instead

If Supabase Storage continues to reject files, we could store events in the **database** instead:

```sql
-- Alternative approach
CREATE TABLE session_events (
  id UUID PRIMARY KEY,
  recording_id UUID REFERENCES session_recordings(id),
  events JSONB,  -- Store events directly in database
  created_at TIMESTAMPTZ
);
```

This would avoid storage MIME type issues entirely.

---

## Summary

**Problem:** Supabase rejected various MIME types for JSON files

**Solution:** Don't specify MIME type - let Supabase auto-detect from `.json` extension

**Result:** Upload should work without MIME type errors

---

## Files Modified

```
smartwish-frontend/src/services/
└── sessionRecordingService.ts    ← Remove MIME type from Blob

smartwish-backend/backend/src/session-recordings/
└── session-recordings.service.ts ← Don't set contentType for JSON
```

---

## Test Checklist

- [ ] Backend restarted with new code
- [ ] Frontend refreshed
- [ ] Kiosk session started
- [ ] Events captured (check console logs)
- [ ] Session ended
- [ ] Upload succeeded (no errors)
- [ ] Files visible in Supabase Storage
- [ ] Files downloadable and parseable as JSON

---

**This should finally fix the MIME type issue!** 🎯

If it still fails, the next step would be to check the Supabase bucket configuration or consider storing events in the database instead of storage.
