# Migration to Python-Based Session Recording

## Objective

Remove all webcam and screen recording code from the frontend/backend and migrate to a Python-based solution integrated with `count_people.py`. The enhanced script will handle:
- Webcam video recording (with camera angle adjustment)
- Screen video recording
- People counting using AI (YOLO)
- Session-based recording (start/stop with sessions)
- Automatic upload to cloud storage when session ends

---

## Part 1: Remove Frontend/Backend Recording Code

### Files to Modify/Remove:

1. **Remove webcam recording from `sessionRecordingService.ts`:**
   - Remove `startWebcamRecording()`, `stopWebcamRecording()`, `uploadWebcamToStorage()`
   - Remove webcam-related private members: `webcamStream`, `webcamMediaRecorder`, `webcamChunks`
   - Remove webcam cleanup in `resetSession()` and `cancelRecording()`

2. **Remove screen recording from `sessionRecordingService.ts`:**
   - Remove `startRecording()`, `stopRecording()`, `captureFrame()`, `captureDOMSnapshot()`, `encodeVideo()`
   - Remove all canvas/frame capture code
   - Keep only session event tracking (DOM snapshots, clicks, etc.) if needed
   - Or remove the entire service if not needed

3. **Remove recording API endpoints:**
   - `smartwish-frontend/src/app/api/kiosk/session/recording/start/route.ts` - DELETE or disable
   - `smartwish-frontend/src/app/api/kiosk/session/recording/upload/route.ts` - DELETE or disable
   - `smartwish-backend/backend/src/session-recordings/session-recordings.controller.ts` - Remove recording endpoints
   - `smartwish-backend/backend/src/session-recordings/session-recordings.service.ts` - Remove upload logic

4. **Update session service:**
   - `smartwish-frontend/src/services/kioskSessionService.ts` - Remove all calls to `sessionRecordingService`
   - `smartwish-frontend/src/contexts/KioskSessionContext.tsx` - Remove recording-related code

5. **Remove recording UI components:**
   - Any components that request recording permissions
   - Recording status indicators in admin pages
   - Video playback components (or keep them but change data source)

---

## Part 2: Enhance `count_people.py` with Video Recording

### New Features to Add:

1. **Webcam Video Recording:**
   - Record webcam video using `cv2.VideoWriter` alongside frame processing
   - Save to session-specific directory: `recordings/{kiosk_id}/{session_id}/webcam_{timestamp}.mp4`
   - Frame rate: 30 FPS
   - Resolution: 1280x720 or configurable

2. **Screen Recording:**
   - Record screen using `mss` (or `PIL.ImageGrab` as fallback)
   - Combine screenshots into video using `cv2.VideoWriter`
   - Save to: `recordings/{kiosk_id}/{session_id}/screen_{timestamp}.mp4`
   - Frame rate: 1 FPS (same as current frame capture)
   - Resolution: Match display resolution or scale to 1920x1080

3. **Camera Angle Adjustment:**
   - Add camera rotation/flip parameters from kiosk config:
     - `camera_rotation` (0, 90, 180, 270 degrees)
     - `camera_flip_horizontal` (boolean)
     - `camera_flip_vertical` (boolean)
   - Apply transformations to webcam frames before processing and recording

4. **Session-Based Recording:**
   - Accept `--session-id` parameter
   - Accept `--session-start` to start recording
   - Accept `--session-end` to stop recording and upload
   - Monitor session status via API or file-based signaling

5. **Upload on Session End:**
   - When session ends, upload webcam and screen videos to cloud storage
   - Use same upload endpoint structure but for Python
   - Upload to Supabase Storage or backend API endpoint
   - Update session_recordings table with video URLs

### New Command-Line Arguments:

```bash
--session-id          Session ID for this recording session
--record-webcam       Enable webcam video recording (default: True)
--record-screen       Enable screen video recording (default: True)
--webcam-fps          Webcam recording FPS (default: 30)
--screen-fps          Screen recording FPS (default: 1)
--camera-rotation     Rotate camera: 0, 90, 180, 270 (default: 0)
--camera-flip-h       Flip camera horizontally (default: False)
--camera-flip-v       Flip camera vertically (default: False)
--output-video-dir    Directory for video recordings (default: ./recordings)
```

### Integration Points:

1. **Session Start:**
   - When a kiosk session starts (via API or file signal), spawn `count_people.py` with session-id
   - Pass kiosk config parameters (camera angle, recording settings)

2. **Session End:**
   - When session ends, send signal to Python process to stop recording
   - Process uploads videos to cloud storage
   - Updates database with recording metadata

3. **Configuration from Admin:**
   - Camera angle settings stored in kiosk config table
   - Retrieved when starting surveillance/recording
   - Passed as command-line arguments to Python script

---

## Part 3: Implementation Details

### Enhanced `count_people.py` Structure:

```python
class VideoRecorder:
    """Handles webcam and screen video recording"""
    
    def __init__(self, config):
        self.webcam_writer = None
        self.screen_writer = None
        self.config = config
        
    def start_webcam_recording(self, session_id):
        # Initialize cv2.VideoWriter for webcam
        pass
        
    def start_screen_recording(self, session_id):
        # Initialize cv2.VideoWriter for screen
        pass
        
    def record_webcam_frame(self, frame):
        # Write frame to webcam video
        pass
        
    def record_screen_frame(self):
        # Capture screen and write to video
        pass
        
    def stop_and_upload(self, session_id):
        # Finalize videos, upload to cloud, cleanup
        pass

class CameraTransformer:
    """Applies camera angle adjustments"""
    
    def transform_frame(self, frame):
        # Apply rotation and flips based on config
        pass
```

### Database Schema Updates:

- Keep `session_recordings` table but change upload mechanism
- Add `recording_method` column: 'python' vs 'browser'
- Store Python script output paths in metadata

### API Endpoints for Python:

1. **Start Recording:**
   ```
   POST /api/kiosk/session/recording/start-python
   Body: { sessionId, kioskId, config }
   Response: { processId, status }
   ```

2. **Stop Recording:**
   ```
   POST /api/kiosk/session/recording/stop-python
   Body: { sessionId, kioskId }
   Response: { status, recordingUrls }
   ```

3. **Upload Video:**
   ```
   POST /api/kiosk/session/recording/upload-python
   Body: FormData { file, sessionId, kioskId, type: 'webcam'|'screen' }
   Response: { storageUrl, storagePath }
   ```

---

## Part 4: Configuration in Admin Panel

### Kiosk Settings Page:

Add new section "Recording Settings":
- **Camera Angle:**
  - Rotation dropdown: 0°, 90°, 180°, 270°
  - Flip Horizontal: checkbox
  - Flip Vertical: checkbox
  - Preview button to test angle

- **Recording Options:**
  - Record Webcam: checkbox (default: enabled)
  - Record Screen: checkbox (default: enabled)
  - Webcam FPS: number input (default: 30)
  - Screen FPS: number input (default: 1)

### Save Configuration:

- Store in `kiosks` table as JSON:
  ```json
  {
    "recording": {
      "cameraRotation": 0,
      "cameraFlipHorizontal": false,
      "cameraFlipVertical": false,
      "recordWebcam": true,
      "recordScreen": true,
      "webcamFps": 30,
      "screenFps": 1
    }
  }
  ```

---

## Part 5: Dependencies

### Python Packages to Install:

```bash
pip install mss  # For screen capture (cross-platform)
pip install Pillow  # For screen capture fallback
pip install opencv-python  # Already installed for video writing
pip install requests  # Already installed for API calls
```

### Optional (for better screen capture):
```bash
pip install pyautogui  # Alternative screen capture
pip install pyscreenshot  # Another alternative
```

---

## Part 6: Testing Checklist

- [ ] Remove all frontend recording code
- [ ] Remove all backend recording endpoints
- [ ] Test `count_people.py` with new recording features
- [ ] Test camera angle adjustments
- [ ] Test webcam video recording
- [ ] Test screen video recording
- [ ] Test session start/stop signals
- [ ] Test video upload to cloud storage
- [ ] Test admin configuration saves correctly
- [ ] Test configuration applies to Python script
- [ ] Verify recordings appear in admin panel
- [ ] Test with multiple concurrent sessions

---

## Implementation Priority

1. **Phase 1:** Remove frontend/backend recording code
2. **Phase 2:** Add video recording to `count_people.py`
3. **Phase 3:** Add camera angle adjustment
4. **Phase 4:** Integrate with session lifecycle
5. **Phase 5:** Add admin configuration UI
6. **Phase 6:** Testing and refinement
