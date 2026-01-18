# Quick Start: Screen Recording Implementation

## What Was Changed?

**Problem:** Sessions were saving component boundaries (boxes) instead of actual screen content.

**Solution:** Now captures real pixels using browser's native screen recording API.

---

## For Developers

### Testing Locally

1. **Start the kiosk:**
   ```bash
   cd smartwish-frontend
   npm run dev
   ```

2. **Activate a kiosk:**
   - Go to `http://localhost:3000/admin/kiosks`
   - Click "Activate Kiosk"
   - Complete pairing

3. **Grant permission:**
   - Permission modal appears on kiosk home
   - Click "Allow Screen Recording"
   - Select the browser tab to share
   - Click "Share"

4. **Test recording:**
   - Navigate away from kiosk home (starts session)
   - Browse around for a bit
   - Return to kiosk home (ends session)
   - Check browser console for upload logs

5. **View recording:**
   - Go to `http://localhost:3000/admin/kiosks`
   - Click on your kiosk
   - Click "Sessions" tab
   - Click on the session
   - Video player should show the recording

### Key Files Changed

```
smartwish-frontend/
├── src/
│   ├── services/
│   │   └── sessionRecordingService.ts          ← Complete rewrite
│   ├── components/
│   │   └── ScreenRecordingPermissionPrompt.tsx ← New component
│   └── app/
│       └── kiosk/
│           └── home/
│               └── page.tsx                     ← Added permission prompt
└── SCREEN_RECORDING_IMPLEMENTATION.md          ← Full documentation
```

### How It Works

```typescript
// 1. Request permission (once per browser session)
await sessionRecordingService.requestPermission();

// 2. Start recording (automatic when session starts)
await sessionRecordingService.startRecording(sessionId, kioskId);

// 3. Stop recording (automatic when session ends)
await sessionRecordingService.stopRecording();
```

### Important APIs

**Permission Request:**
```typescript
navigator.mediaDevices.getDisplayMedia({
  video: {
    displaySurface: 'browser',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
  audio: false,
});
```

**Recording:**
```typescript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 2500000, // 2.5 Mbps
});
```

---

## For QA/Testing

### Test Scenarios

**✅ Happy Path:**
1. Activate kiosk → Permission granted → Session recorded → Video playable

**✅ Permission Denied:**
1. Activate kiosk → Permission denied → Session continues without recording

**✅ Permission Skipped:**
1. Activate kiosk → Click "Skip for Now" → Session continues without recording

**✅ Long Session:**
1. Record for 15+ minutes → Recording stops at max duration → Video uploaded

**✅ Browser Restart:**
1. Grant permission → Restart browser → Permission needs to be granted again

### What to Check

- [ ] Permission modal appears after pairing
- [ ] Permission can be granted
- [ ] Permission can be denied
- [ ] Permission can be skipped
- [ ] Recording starts when session starts
- [ ] Recording stops when session ends
- [ ] Video uploads successfully
- [ ] Thumbnail is generated
- [ ] Video is playable in admin panel
- [ ] No errors in browser console
- [ ] Session tracking works even if recording fails

### Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Grant permission | Modal closes, recording enabled |
| Deny permission | Modal shows "Permission Denied", can continue |
| Skip permission | Modal closes, recording disabled |
| Start session | Recording starts automatically |
| End session | Recording stops and uploads |
| View in admin | Video plays with thumbnail |

---

## For Admins

### Viewing Recordings

1. Go to **Admin → Kiosks**
2. Click on a kiosk
3. Click **Sessions** tab
4. Click on a session
5. Video player shows the recording

### Storage Location

Recordings are stored in Supabase:
- **Bucket:** `session-recordings`
- **Videos:** `videos/{sessionId}_{timestamp}.webm`
- **Thumbnails:** `thumbnails/{sessionId}_thumb.jpg`

### File Sizes

- **1 minute:** ~18 MB
- **5 minutes:** ~90 MB
- **10 minutes:** ~180 MB
- **15 minutes:** ~280 MB (max)

### Cleanup

To prevent storage bloat, consider:
- Deleting recordings older than 30 days
- Archiving important recordings
- Monitoring storage usage in Supabase dashboard

---

## Troubleshooting

### "Permission prompt doesn't appear"

**Check:**
- Are you on HTTPS? (required)
- Did you complete kiosk pairing?
- Check URL has `?pairingComplete=true`

**Fix:**
- Ensure HTTPS is enabled
- Complete pairing flow properly

### "Recording not starting"

**Check:**
- Browser console for errors
- Was permission granted?
- Is MediaRecorder supported?

**Fix:**
```javascript
// Check support
if (typeof MediaRecorder === 'undefined') {
  console.error('MediaRecorder not supported');
}

// Check permission
if (!sessionRecordingService.hasPermission) {
  console.error('No screen capture permission');
}
```

### "Upload failed"

**Check:**
- Supabase bucket exists?
- Storage quota available?
- Network connectivity?

**Fix:**
- Create bucket: `session-recordings`
- Check Supabase dashboard for quota
- Verify network connection

### "Video won't play"

**Check:**
- Is video format supported? (WebM/MP4)
- Is storage URL valid?
- Are there CORS issues?

**Fix:**
- Check browser console for errors
- Verify storage URL is accessible
- Check Supabase CORS settings

---

## Quick Commands

### Check Recording Status
```javascript
// In browser console
sessionRecordingService.getStatus()
// Returns: 'idle' | 'recording' | 'processing' | 'uploading' | 'completed' | 'failed'
```

### Check Permission
```javascript
sessionRecordingService.hasPermission
// Returns: true | false
```

### Get Metadata
```javascript
sessionRecordingService.getMetadata()
// Returns: { sessionId, kioskId, startedAt, duration, resolution, status, ... }
```

---

## Environment Requirements

### Browser
- Chrome 72+ ✅
- Firefox 66+ ✅
- Safari 13+ ✅
- Edge 79+ ✅

### Protocol
- **HTTPS required** (getDisplayMedia API restriction)
- HTTP will fail silently

### Storage
- Supabase bucket: `session-recordings`
- Sufficient storage quota (plan for ~280 MB per 15-min session)

---

## Deployment Checklist

Before deploying to production:

- [ ] Test on staging environment
- [ ] Verify HTTPS is enabled
- [ ] Create Supabase bucket `session-recordings`
- [ ] Set up storage RLS policies
- [ ] Test cross-browser compatibility
- [ ] Monitor storage usage
- [ ] Set up cleanup job for old recordings
- [ ] Document for support team
- [ ] Train admins on viewing recordings

---

## Support

**Questions?** Check:
1. `SCREEN_RECORDING_IMPLEMENTATION.md` - Full technical docs
2. `SCREEN_RECORDING_CHANGES_SUMMARY.md` - Detailed changes
3. Browser console - Error messages
4. Supabase dashboard - Storage status

**Still stuck?** Contact the development team.

---

## Summary

✅ **What:** Actual screen recording instead of component boundaries
✅ **How:** MediaRecorder API + getDisplayMedia
✅ **When:** Automatically during kiosk sessions
✅ **Where:** Stored in Supabase `session-recordings` bucket
✅ **Why:** Better UX insights and session replay

**Ready to test!** 🚀
