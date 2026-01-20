# Upload Troubleshooting Guide

## Current Issue: Videos Not Uploading to Supabase

With the enhanced logging, you should now see detailed logs at every step of the upload process.

## Check Logs

### 1. Frontend (Browser Console)
Look for logs starting with `[Recording]`:
- `[Recording] Preparing upload: ...` - Shows blob size and type
- `[Recording] Uploading to /api/kiosk/session/recording/upload...`
- `[Recording] Upload response status: ...`
- `[Recording] Upload response data: ...`

### 2. Frontend API Route (Server Console/Logs)
Look for logs starting with `[Recording Upload API]`:
- `[Recording Upload API] Upload attempt: ...` - Shows file info
- `[Recording Upload API] Forwarding to backend...`
- `[Recording Upload API] Backend response status: ...`

### 3. Backend Controller (Backend Logs)
Look for logs starting with `[Upload Controller]`:
- `[Upload Controller] Received upload request: ...` - Confirms file was received
- `[Upload Controller] Calling uploadFile service...`

### 4. Backend Service (Backend Logs)
Look for logs starting with `[Upload]`:
- `[Upload] Starting upload: ...` - File details
- `[Upload] Checking if bucket exists...`
- `[Upload] Bucket exists: ...` - **CRITICAL**: Check this!
- `[Upload] Uploading to: ...` - File path
- `[Upload] File uploaded successfully: ...`
- `[Upload] Signed URL created: ...`
- `[Upload] Recording record updated successfully`

## Common Issues

### Issue 1: "Bucket does not exist"
**Symptoms**: Log shows `[Upload] Bucket exists: false`

**Solution**: Create the bucket in Supabase:
1. Go to Supabase Dashboard → Storage
2. Click "Create a new bucket"
3. Name: `session-recordings`
4. Public: No (Private)
5. File size limit: 100MB
6. Allowed MIME types: `video/webm,video/mp4,image/jpeg,image/png,application/json`

Or run this SQL in Supabase SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-recordings', 
    'session-recordings', 
    false,
    104857600,
    ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json'];
```

### Issue 2: "No file received"
**Symptoms**: `[Upload Controller] No file received`

**Possible Causes**:
- FormData not being forwarded correctly
- File size too large (> 100MB)
- Content-Type header missing

**Solution**: Check browser console for FormData errors

### Issue 3: "File buffer is empty"
**Symptoms**: `[Upload Controller] File buffer is empty`

**Possible Causes**:
- Video encoding failed
- Blob is empty
- FormData corrupted during transfer

**Solution**: Check if video encoding succeeded in browser console

### Issue 4: Backend not receiving request
**Symptoms**: No `[Upload Controller]` logs

**Possible Causes**:
- Frontend API route not forwarding correctly
- Backend URL incorrect
- Network/CORS issues

**Solution**: 
- Check `BACKEND_URL` environment variable
- Check browser Network tab for failed requests
- Check backend logs for incoming requests

## Quick Diagnostic Steps

1. **Check if bucket exists**:
   ```sql
   SELECT name FROM storage.buckets WHERE name = 'session-recordings';
   ```

2. **Check recent upload attempts in database**:
   ```sql
   SELECT 
     id, 
     session_id, 
     status, 
     error_message,
     storage_path,
     storage_url,
     created_at
   FROM session_recordings
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Check storage files** (in Supabase Dashboard → Storage → session-recordings):
   - Navigate to `videos/`, `thumbnails/`, and `webcam/` folders
   - See if any files exist

4. **Test with a manual upload**:
   - Use browser console on kiosk page
   - Start a session
   - Wait 10 seconds
   - Check all logs
   - End session
   - Watch for upload logs

## Next Steps After Checking Logs

Based on what logs you see:

1. **If you see "Bucket does not exist"**: Create the bucket (see Issue 1)
2. **If you see "No file received"**: Check FormData forwarding
3. **If you see "Upload error" with Supabase error**: Check Supabase storage permissions
4. **If no logs at all**: Check if recording is actually starting

## Storage Permissions

Make sure these policies exist in Supabase:

```sql
-- Allow authenticated users to view recordings
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

-- Allow service role to upload (for backend)
CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'session-recordings');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');
```

Run these in Supabase SQL Editor if policies don't exist.
