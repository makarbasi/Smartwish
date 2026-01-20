# Session Recording Debug Guide

## Issues Fixed

### 1. Screen Recordings Not Available
- **Fixed**: Improved error handling and logging throughout the recording pipeline
- **Fixed**: html2canvas now properly captures actual pixels (not wireframes)
- **Check**: Browser console for `[Recording]` logs

### 2. Webcam Not Saved
- **Fixed**: Backend controller now accepts 'webcam' type
- **Fixed**: Better error handling and logging for webcam recording
- **Check**: Browser console for webcam-specific logs

## Debugging Steps

### 1. Check Browser Console
Look for logs starting with `[Recording]`:
- `[Recording] Starting screen recording for session: ...`
- `[Recording] Webcam recording started successfully`
- `[Recording] Captured frame X`
- `[Recording] Encoding X frames to video...`
- `[Recording] Uploaded: ...`

### 2. Check Screen Recording Status

In browser console:
```javascript
// Check if recording service is active
window.sessionRecordingService?.isRecording

// Check status
window.sessionRecordingService?.getStatus()

// Check metadata
window.sessionRecordingService?.getMetadata()
```

### 3. Check Webcam Recording

```javascript
// Check if webcam stream exists (private, but check console logs)
// Look for: "[Recording] Webcam MediaRecorder started, state: recording"
```

### 4. Common Issues

#### Issue: No frames captured
- **Cause**: html2canvas might be failing silently
- **Fix**: Check browser console for html2canvas errors
- **Solution**: Ensure html2canvas package is installed (`npm install html2canvas`)

#### Issue: Webcam not starting
- **Cause**: Camera permission denied or camera unavailable
- **Check**: Browser console for `[Recording] Webcam access denied or unavailable`
- **Solution**: Grant camera permissions in browser settings

#### Issue: Upload failing
- **Cause**: Storage bucket not configured
- **Check**: Backend logs for "Storage bucket not configured"
- **Solution**: Create `session-recordings` bucket in Supabase Storage

#### Issue: Recording shows "not available" in admin
- **Check**: Recording status in database
- **Query**: 
  ```sql
  SELECT id, session_id, status, error_message, storage_url, storage_path
  FROM session_recordings 
  WHERE session_id = 'YOUR_SESSION_ID'
  ORDER BY created_at DESC LIMIT 1;
  ```

### 5. Database Checks

Check if recordings exist:
```sql
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_url IS NOT NULL as has_video_url,
  webcam_storage_url IS NOT NULL as has_webcam_url,
  created_at,
  updated_at
FROM session_recordings
ORDER BY created_at DESC
LIMIT 10;
```

Check storage bucket exists:
```sql
-- Run in Supabase SQL Editor
SELECT name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'session-recordings';
```

### 6. Storage Bucket Setup

If bucket doesn't exist, create it:
```sql
-- Create storage bucket for session recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-recordings', 
    'session-recordings', 
    false,  -- Private bucket
    104857600,  -- 100MB max file size
    ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json'];

-- Storage policies (run in Supabase Dashboard SQL Editor)
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'session-recordings');

CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');
```

### 7. Testing Recording Flow

1. **Start a kiosk session** - check console for recording start
2. **Wait 5-10 seconds** - check that frames are being captured
3. **End the session** - check console for upload progress
4. **Check admin page** - verify recording appears

### 8. Manual Test Commands

```javascript
// In browser console on kiosk page
const service = window.sessionRecordingService || (await import('/src/services/sessionRecordingService')).sessionRecordingService;

// Start test recording
await service.startRecording('test-session-' + Date.now(), 'test-kiosk');

// Wait a few seconds, then check
service.getMetadata();

// Stop recording
await service.stopRecording();
```

## Files Modified

1. `smartwish-frontend/src/services/sessionRecordingService.ts`
   - Added html2canvas for pixel-perfect capture
   - Added webcam recording functionality
   - Improved error handling and logging

2. `smartwish-backend/backend/src/session-recordings/session-recordings.controller.ts`
   - Added 'webcam' to accepted upload types

3. `smartwish-backend/backend/src/session-recordings/session-recordings.service.ts`
   - Added webcam storage columns handling
   - Added bucket existence check

4. `smartwish-frontend/supabase/migrations/017_add_webcam_recording_columns.sql`
   - Added webcam storage columns

5. `smartwish-frontend/src/app/admin/kiosks/[kioskId]/sessions/page.tsx`
   - Improved error message display

6. `smartwish-backend/print-agent-deployment/surveillance/count_people.py`
   - Fixed to only save images after 8+ seconds

## Next Steps

1. Run the migration: `017_add_webcam_recording_columns.sql`
2. Verify storage bucket exists
3. Test recording with browser console open
4. Check database for recording records
5. Check Supabase Storage for uploaded files
