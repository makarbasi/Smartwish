# Screen Recording Implementation - Actual Pixel Capture

## Overview

This document describes the implementation of **actual screen recording** for kiosk sessions. The system now captures real pixels from the display using the MediaRecorder API, replacing the previous DOM snapshot approach that only captured component boundaries.

## What Changed

### Before (DOM Snapshot)
- Captured UI component frames (position, size, type)
- Created a visual representation showing component boundaries
- Resulted in a grid-like view with placeholders instead of actual content
- Missing: images, rendered text, colors, graphics

### After (Actual Screen Recording)
- Captures actual screen pixels using `getDisplayMedia()` API
- Records as genuine video format (WebM or MP4)
- Pixel-perfect reproduction of user's screen
- All visual elements preserved: images, text, colors, animations

## Technical Implementation

### 1. Screen Capture Permission

**File:** `smartwish-frontend/src/components/ScreenRecordingPermissionPrompt.tsx`

A modal component that requests screen recording permission when the kiosk is first activated:
- Shows after kiosk pairing is complete
- Uses browser's native `getDisplayMedia()` API
- Gracefully handles permission denial
- Can be dismissed if user declines

### 2. Recording Service

**File:** `smartwish-frontend/src/services/sessionRecordingService.ts`

Complete rewrite to use MediaRecorder API:

```typescript
// Key features:
- Uses getDisplayMedia() for screen capture
- MediaRecorder captures at 30fps for smooth playback
- Video bitrate: 2.5 Mbps (good quality for UI)
- Target resolution: 1920x1080
- Max recording duration: 15 minutes
- Automatic chunking every 10 seconds
```

**Workflow:**
1. Request permission via `requestPermission()` - gets MediaStream
2. Start recording via `startRecording()` - creates MediaRecorder
3. Collect video chunks as they're recorded
4. Stop recording via `stopRecording()` - triggers processing
5. Generate thumbnail from first frame
6. Upload video and thumbnail to Supabase
7. Update database with metadata

### 3. Session Integration

**File:** `smartwish-frontend/src/services/kioskSessionService.ts`

The session service automatically starts/stops recording:
- Recording starts when session begins
- Recording stops when session ends
- Non-blocking - doesn't affect session tracking if recording fails

### 4. Permission Flow

**File:** `smartwish-frontend/src/app/kiosk/home/page.tsx`

Permission prompt appears:
- After kiosk pairing completes (`?pairingComplete=true`)
- Shows modal overlay with clear explanation
- User can allow or skip
- Permission persists for subsequent sessions

## API Endpoints

All endpoints are proxies to the backend:

### POST `/api/kiosk/session/recording/start`
Create recording record in database
```json
{
  "sessionId": "uuid",
  "kioskId": "string",
  "resolution": "1920x1080"
}
```

### POST `/api/kiosk/session/recording/upload`
Upload video or thumbnail
```
FormData:
- file: Blob (video or thumbnail)
- sessionId: string
- kioskId: string
- recordingId: string
- type: "video" | "thumbnail"
```

### PATCH `/api/kiosk/session/recording/status`
Update recording status
```json
{
  "recordingId": "uuid",
  "status": "recording" | "processing" | "uploading" | "completed" | "failed",
  "errorMessage": "string (optional)"
}
```

### POST `/api/kiosk/session/recording/complete`
Finalize recording
```json
{
  "recordingId": "uuid",
  "sessionId": "uuid",
  "storageUrl": "string",
  "thumbnailUrl": "string",
  "duration": number,
  "fileSize": number
}
```

## Database Schema

**Table:** `session_recordings`

```sql
CREATE TABLE session_recordings (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES kiosk_sessions(id),
    kiosk_id TEXT NOT NULL,
    
    -- Storage
    storage_path TEXT,
    storage_url TEXT,
    thumbnail_path TEXT,
    thumbnail_url TEXT,
    
    -- Metadata
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    format TEXT DEFAULT 'webm',
    resolution TEXT,
    
    -- Status
    status TEXT CHECK (status IN (
        'recording',
        'processing',
        'uploading',
        'completed',
        'failed'
    )),
    error_message TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

## Storage

**Bucket:** `session-recordings` (Supabase Storage)

Structure:
```
session-recordings/
├── videos/
│   ├── {sessionId}_{timestamp}.webm
│   └── {sessionId}_{timestamp}.mp4
└── thumbnails/
    └── {sessionId}_thumb.jpg
```

## Video Formats

The system automatically selects the best supported codec:

1. **Preferred:** `video/webm;codecs=vp9` (best compression)
2. **Fallback:** `video/webm;codecs=vp8`
3. **Fallback:** `video/webm;codecs=h264`
4. **Fallback:** `video/webm` (default)
5. **Fallback:** `video/mp4` (rare)

## Thumbnail Generation

Thumbnails are extracted from the recorded video:
- Seeks to 1 second into video
- Captures frame at 640x360 resolution
- Saved as JPEG with 85% quality
- Uploaded separately to `thumbnails/` folder

## Error Handling

The recording system is designed to be non-critical:
- If permission is denied, sessions continue without recording
- If recording fails, session tracking is unaffected
- Errors are logged but don't interrupt user experience
- Failed recordings are marked in database for admin review

## Performance Considerations

1. **Memory:** Video chunks are collected in memory during recording
2. **Upload:** Chunked every 10 seconds to prevent memory issues
3. **Max Duration:** 15 minutes to prevent excessive file sizes
4. **Bitrate:** 2.5 Mbps balances quality and file size
5. **Non-blocking:** Recording runs in background, doesn't block UI

## Browser Compatibility

**Required APIs:**
- `MediaDevices.getDisplayMedia()` - Chrome 72+, Firefox 66+, Safari 13+
- `MediaRecorder` - Chrome 47+, Firefox 25+, Safari 14.1+

**Graceful Degradation:**
- If APIs not supported, sessions continue without recording
- Permission denial doesn't affect kiosk functionality

## Admin Playback

Recordings can be viewed in the admin panel:
- Navigate to Kiosks → Sessions → View Session
- Video player shows actual screen recording
- Thumbnail provides preview
- Metadata shows duration, file size, resolution

## Testing

To test the implementation:

1. **Activate Kiosk:**
   - Log in as manager
   - Go to Admin → Kiosks
   - Activate a kiosk
   - Complete pairing

2. **Grant Permission:**
   - Permission prompt appears on kiosk home
   - Click "Allow Screen Recording"
   - Select the browser tab to share
   - Click "Share"

3. **Start Session:**
   - Navigate away from kiosk home
   - Recording starts automatically
   - Red "REC" indicator shows in browser (native)

4. **End Session:**
   - Return to kiosk home or timeout
   - Recording stops and uploads
   - Check admin panel for playback

## Troubleshooting

### Permission Denied
- User must manually grant permission
- Can't be automated for security reasons
- Permission persists until browser restart

### Recording Not Starting
- Check browser console for errors
- Verify MediaRecorder support
- Ensure HTTPS (required for getDisplayMedia)

### Upload Failures
- Check Supabase storage bucket exists
- Verify bucket is named "session-recordings"
- Check storage quota limits
- Review network connectivity

### Large File Sizes
- 15-minute recording ≈ 280 MB at 2.5 Mbps
- Consider reducing bitrate if needed
- Implement automatic cleanup for old recordings

## Future Enhancements

Potential improvements:
1. **Compression:** Post-process videos for smaller files
2. **Streaming:** Stream directly to storage instead of buffering
3. **Quality Settings:** Let admins configure bitrate/resolution
4. **Auto-cleanup:** Delete recordings older than X days
5. **Analytics:** Extract heatmaps from recordings
6. **Privacy:** Blur sensitive areas automatically

## Security & Privacy

- Recordings only capture browser tab, not entire screen
- User must explicitly grant permission
- Recordings stored securely in Supabase
- Access restricted to authenticated admins
- Consider adding data retention policies
- Comply with local privacy regulations

## Summary

The new screen recording implementation provides **actual pixel-level capture** of kiosk sessions, enabling admins to see exactly what users see. This is a significant improvement over the previous DOM snapshot approach and provides valuable insights for UX optimization.

**Key Benefits:**
✅ Real screen pixels, not component boundaries
✅ See actual images, text, and graphics
✅ Smooth 30fps video playback
✅ Automatic thumbnail generation
✅ Non-blocking and fault-tolerant
✅ Works across modern browsers
✅ Secure storage in Supabase
