# Recording Upload Diagnostic Checklist

Since no videos are appearing in Supabase storage, let's systematically check where the issue is:

## Step 1: Check Database Records

Run this in Supabase SQL Editor (`DIAGNOSE_RECORDING_ISSUE.sql`):

```sql
-- Check if recordings are being created
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_url,
  storage_path,
  created_at,
  updated_at
FROM session_recordings
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- ✅ **If records exist**: Recording is starting, check status and error_message
- ❌ **If no records**: Recording isn't starting at all

## Step 2: Check Recent Sessions

```sql
SELECT 
  ks.id as session_id,
  ks.started_at,
  ks.has_recording,
  sr.status as recording_status,
  sr.storage_url IS NOT NULL as has_video_file,
  sr.error_message
FROM kiosk_sessions ks
LEFT JOIN session_recordings sr ON sr.session_id = ks.id
ORDER BY ks.started_at DESC
LIMIT 5;
```

**What to look for:**
- Does `has_recording = true`?
- What is `recording_status`? (recording, processing, uploading, completed, failed)
- Any `error_message`?

## Step 3: Check Browser Console

**When starting a session**, you should see:
1. `[SessionService] Session started: ...`
2. `[SessionService] Starting screen recording for session: ...`
3. `[Recording] Starting screen recording for session: ...`
4. `[Recording] Captured frame 1`, `[Recording] Captured frame 10`, etc.
5. When ending session:
   - `[Recording] Stopping recording, processing X frames`
   - `[Recording] Encoding X frames to video...`
   - `[Recording] Video encoded successfully, size: X bytes`
   - `[Recording] Preparing upload: ...`
   - `[Recording] Uploading to /api/kiosk/session/recording/upload...`

**If you DON'T see these logs:**
- Recording might not be starting
- Check if session is actually starting
- Check browser console for errors

## Step 4: Check Network Tab

**In browser DevTools → Network tab:**
1. Start a kiosk session
2. Wait 10+ seconds
3. End the session
4. Look for requests to:
   - `/api/kiosk/session/recording/start` - Should be called
   - `/api/kiosk/session/recording/upload` - Should be called when session ends
   - Check response status and body

**What to look for:**
- ✅ `recording/start` returns `{ recordingId: "..." }`
- ✅ `recording/upload` returns `{ storageUrl: "...", storagePath: "..." }`
- ❌ Any failed requests (red status codes)
- ❌ Empty or error responses

## Step 5: Common Issues

### Issue A: No Recording Records in Database
**Symptom**: Query returns 0 rows

**Possible causes:**
1. Session not starting
2. `startRecording()` failing silently
3. API endpoint not working

**Check:**
- Browser console for `[Recording] Starting screen recording...`
- Network tab for `/api/kiosk/session/recording/start` request

### Issue B: Recording Status Stuck at "recording" or "processing"
**Symptom**: Status never reaches "completed"

**Possible causes:**
1. Frames not being captured (html2canvas failing)
2. Video encoding failing
3. Upload failing

**Check:**
- Browser console for "Captured frame" logs
- Browser console for "Encoding" logs
- Browser console for "Upload" logs

### Issue C: Recording Status = "failed"
**Symptom**: Status is "failed", error_message exists

**Check error_message:**
- "No frames captured" → html2canvas not working
- "Failed to encode video" → MediaRecorder issue
- "Upload failed: ..." → Check backend logs
- "Storage bucket not configured" → Bucket doesn't exist (but you confirmed it does)

### Issue D: Recording Status = "completed" but no storage_url
**Symptom**: Status is "completed" but `storage_url IS NULL`

**Possible causes:**
1. Upload succeeded but URL generation failed
2. Upload failed but status was set to completed anyway

**Check:**
- Backend logs for `[Upload]` messages
- Check if `storage_path` exists (should match a file in storage)

## Step 6: Manual Test

**Run this in browser console on kiosk page:**

```javascript
// Import the service (adjust path if needed)
const { sessionRecordingService } = await import('/src/services/sessionRecordingService');

// Start a test recording
const sessionId = 'test-' + Date.now();
const kioskId = 'test-kiosk'; // Use actual kiosk ID

console.log('Starting test recording...');
const started = await sessionRecordingService.startRecording(sessionId, kioskId);
console.log('Recording started:', started);

// Wait 5 seconds for frames
await new Promise(r => setTimeout(r, 5000));

// Check status
const metadata = sessionRecordingService.getMetadata();
console.log('Recording metadata:', metadata);

// Stop recording
console.log('Stopping recording...');
const url = await sessionRecordingService.stopRecording();
console.log('Recording stopped, URL:', url);
```

**Watch for:**
- Does `startRecording` return `true`?
- Does `getMetadata()` show `frameCount > 0`?
- Does `stopRecording()` return a URL?
- Check browser console for errors

## Step 7: Check Backend Logs

**When upload happens, you should see in backend logs:**

```
[Upload Controller] Received upload request: ...
[Upload] Starting upload: type=video, size=...
[Upload] Checking if bucket exists...
[Upload] Bucket exists: true
[Upload] Uploading to: videos/...
[Upload] File uploaded successfully: ...
[Upload] Signed URL created: ...
```

**If you don't see these:**
- Upload request not reaching backend
- Check frontend API route logs
- Check network connectivity

## Step 8: Verify Upload Actually Happens

**Even if logs show success, check:**

1. **Database** - Does `storage_path` have a value?
2. **Supabase Storage Dashboard** - Navigate to `session-recordings` → `videos/` folder
3. **File size** - If file exists but is 0 bytes, encoding failed

## Quick Fix: Test with Minimal Recording

**If nothing works, try this minimal test:**

```javascript
// In browser console
const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 720;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ff0000';
ctx.fillRect(0, 0, 1280, 720);
ctx.fillStyle = '#ffffff';
ctx.font = '48px Arial';
ctx.fillText('TEST RECORDING', 400, 360);

// Convert to blob
canvas.toBlob(async (blob) => {
  if (!blob) {
    console.error('Failed to create blob');
    return;
  }
  
  console.log('Test blob size:', blob.size);
  
  // Try uploading directly
  const formData = new FormData();
  formData.append('file', blob, 'test.jpg');
  formData.append('sessionId', 'test-session');
  formData.append('kioskId', 'test-kiosk');
  formData.append('recordingId', 'test-recording-id');
  formData.append('type', 'video');
  
  try {
    const response = await fetch('/api/kiosk/session/recording/upload', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    console.log('Upload response:', data);
  } catch (error) {
    console.error('Upload error:', error);
  }
}, 'image/jpeg');
```

This tests if:
1. Blob creation works
2. Upload endpoint works
3. Backend can receive and process the file

---

## Most Likely Issues Based on Symptoms

### If no database records exist:
→ Recording not starting, check browser console

### If records exist but status = "recording":
→ Frames not being captured or encoding not happening, check frame capture logs

### If records exist, status = "failed", error = "No frames captured":
→ html2canvas not working, check browser console for html2canvas errors

### If records exist, status = "failed", error = "Upload failed":
→ Backend issue or storage issue, check backend logs

### If records exist, status = "completed", but no file in storage:
→ Upload succeeded but file wasn't actually saved, check backend logs for storage errors

Run the diagnostic queries and check browser/backend logs to identify which case you're experiencing!
