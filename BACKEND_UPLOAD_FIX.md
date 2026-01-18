# Backend Upload Fix - Event Logging Support

## Issue

The backend was rejecting event uploads because the `UploadRecordingDto` type only accepted `'video' | 'thumbnail'` but the frontend was sending `type: 'events'` for JSON event files.

**Error:**
```
[Recording] Failed to upload events: Error: Upload failed
```

## Solution

Updated the backend to accept and properly handle `'events'` type uploads.

---

## Changes Made

### 1. **Updated DTO Type Definition**

**File:** `session-recordings.service.ts`

**Before:**
```typescript
export interface UploadRecordingDto {
  recordingId: string;
  sessionId: string;
  kioskId: string;
  type: 'video' | 'thumbnail';
}
```

**After:**
```typescript
export interface UploadRecordingDto {
  recordingId: string;
  sessionId: string;
  kioskId: string;
  type: 'video' | 'thumbnail' | 'events';  // ← Added 'events'
}
```

---

### 2. **Updated Upload File Handler**

**File:** `session-recordings.service.ts`

**Changes:**
1. Added `isEvents` flag to detect events uploads
2. Changed folder logic to support `events/` folder
3. Updated database update logic to handle events

**Before:**
```typescript
const isThumbnail = dto.type === 'thumbnail';
const folder = isThumbnail ? 'thumbnails' : 'videos';
```

**After:**
```typescript
const isThumbnail = dto.type === 'thumbnail';
const isEvents = dto.type === 'events';

// Determine folder based on type
const folder = isThumbnail ? 'thumbnails' : isEvents ? 'events' : 'videos';
```

**Database Update Logic:**
```typescript
if (isThumbnail) {
  // Thumbnail upload
  updateData.thumbnail_path = fileName;
  updateData.thumbnail_url = storageUrl;
} else if (isEvents) {
  // Events upload - store in storage_path but mark format as 'json'
  updateData.storage_path = fileName;
  updateData.storage_url = storageUrl;
  updateData.file_size_bytes = file.length;
  updateData.format = 'json';  // ← Mark as JSON format
} else {
  // Video upload
  updateData.storage_path = fileName;
  updateData.storage_url = storageUrl;
  updateData.file_size_bytes = file.length;
}
```

---

### 3. **Updated Controller Type Cast**

**File:** `session-recordings.controller.ts`

**Before:**
```typescript
type: body.type as 'video' | 'thumbnail',
```

**After:**
```typescript
type: body.type as 'video' | 'thumbnail' | 'events',
```

**Comment updated:**
```typescript
/**
 * Upload recording file (video, thumbnail, or events)
 */
```

---

## Storage Structure

Events are now stored in the proper folder:

```
session-recordings/
├── videos/
│   └── {sessionId}_{timestamp}.webm
├── thumbnails/
│   └── {sessionId}_thumb.jpg
└── events/                              ← New folder
    ├── {sessionId}_events_{timestamp}.json
    ├── {sessionId}_events_{timestamp}.json
    └── {sessionId}_events_{timestamp}.json
```

---

## Database Schema

The `format` field in `session_recordings` table is set to `'json'` for event recordings:

```sql
-- For event-based recordings
format = 'json'

-- For video recordings  
format = 'webm' or 'mp4'
```

This allows you to distinguish between:
- **Video recordings** (`format = 'webm'` or `'mp4'`)
- **Event recordings** (`format = 'json'`)

---

## Testing

### 1. Start the backend
```bash
cd smartwish-backend/backend
npm run start:dev
```

### 2. Start the frontend
```bash
cd smartwish-frontend
npm run dev
```

### 3. Test event upload

Browse a kiosk session and check the console for:

```
✅ [Recording] Starting event logging for session: abc-123
✅ [Recording] Captured DOM snapshot
✅ [Recording] Uploaded 145 events          ← Should succeed now
✅ [Recording] Recording completed successfully
```

### 4. Verify in Supabase

1. Go to Supabase Dashboard
2. Navigate to **Storage** → **session-recordings**
3. Check **events/** folder
4. You should see JSON files:
   - `{sessionId}_events_{timestamp}.json`

### 5. Verify in Database

```sql
SELECT 
  id,
  session_id,
  format,
  storage_path,
  file_size_bytes,
  status
FROM session_recordings
WHERE format = 'json'
ORDER BY created_at DESC;
```

Should show:
```
format: json
storage_path: events/{sessionId}_events_1234567890.json
status: completed
```

---

## What This Fixes

✅ **Event uploads now work** - No more "Upload failed" errors
✅ **Proper folder structure** - Events go to `events/` folder
✅ **Database tracking** - Format marked as `'json'`
✅ **Backend compatibility** - Accepts all three types

---

## Files Modified

```
smartwish-backend/backend/src/session-recordings/
├── session-recordings.service.ts       ← Updated DTO and upload logic
└── session-recordings.controller.ts    ← Updated type cast
```

---

## Summary

The backend now properly handles event logging uploads by:

1. **Accepting** `type: 'events'` in upload requests
2. **Storing** JSON files in `events/` folder
3. **Marking** format as `'json'` in database
4. **Tracking** file size and storage path

**Event uploads should now work successfully!** ✅

---

## Next Steps

1. **Deploy backend changes** to your server
2. **Test end-to-end** with a kiosk session
3. **Monitor uploads** in Supabase storage
4. **Verify** no more upload errors in console

---

## Troubleshooting

### Still getting upload errors?

**Check:**
1. Backend is running and updated
2. Supabase bucket `session-recordings` exists
3. Bucket has `events/` folder permissions
4. File size is under 100MB limit

**Test manually:**
```bash
# Check if endpoint is working
curl -X POST http://localhost:3001/kiosk/session/recording/upload \
  -F "file=@test.json" \
  -F "sessionId=test-123" \
  -F "kioskId=test-kiosk" \
  -F "type=events"
```

### Bucket not found?

Create the bucket in Supabase:
1. Go to **Storage**
2. Click **Create Bucket**
3. Name: `session-recordings`
4. Public: No (keep private)
5. Click **Create**

---

## Complete!

The backend now fully supports event logging uploads. Your silent session recording system should work end-to-end! 🎯
