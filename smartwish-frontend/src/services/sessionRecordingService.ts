/**
 * Session Recording Service
 * 
 * Captures screen recordings of kiosk sessions at 1 FPS for admin review.
 * Uses Screen Capture API for actual pixel capture, with html2canvas fallback for pixel-perfect capture.
 * Also captures webcam video during sessions.
 */

import html2canvas from 'html2canvas';

// ==================== Types ====================

export interface RecordingMetadata {
  sessionId: string;
  kioskId: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  frameCount?: number;
  resolution?: string;
  status: RecordingStatus;
  errorMessage?: string;
}

export type RecordingStatus = 
  | 'idle' 
  | 'recording' 
  | 'processing' 
  | 'uploading' 
  | 'completed' 
  | 'failed';

interface RecordingFrame {
  timestamp: number;
  dataUrl: string;
}

// ==================== Configuration ====================

const FRAME_RATE = 1; // 1 frame per second
const FRAME_INTERVAL_MS = 1000 / FRAME_RATE;
const MAX_RECORDING_DURATION_MS = 10 * 60 * 1000; // 10 minutes max
const MAX_FRAMES = MAX_RECORDING_DURATION_MS / FRAME_INTERVAL_MS;
const JPEG_QUALITY = 0.8; // Higher quality for screen capture
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;

// ==================== Service Class ====================

class SessionRecordingService {
  private sessionId: string | null = null;
  private kioskId: string | null = null;
  private status: RecordingStatus = 'idle';
  private startedAt: Date | null = null;
  private frames: RecordingFrame[] = [];
  private captureInterval: NodeJS.Timeout | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private recordingDbId: string | null = null;
  private errorMessage: string | null = null;
  
  // Screen capture stream
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private hasScreenCapturePermission: boolean = false;

  // Webcam recording
  private webcamStream: MediaStream | null = null;
  private webcamMediaRecorder: MediaRecorder | null = null;
  private webcamChunks: Blob[] = [];

  constructor() {
    // Check if we already have permission (from previous session)
    this.checkExistingPermission();
  }

  /**
   * Check if we might have existing screen capture permission
   */
  private async checkExistingPermission(): Promise<void> {
    // We can't actually check permission without requesting it,
    // so we'll just try to use it when needed
  }

  // ==================== Public API ====================

  /**
   * Request screen capture permission (call this during kiosk activation)
   * Returns true if permission was granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      console.log('[Recording] Requesting screen capture permission...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          width: { ideal: TARGET_WIDTH },
          height: { ideal: TARGET_HEIGHT },
          frameRate: { ideal: FRAME_RATE },
        },
        audio: false,
      });

      // Permission granted! Store the stream for later use
      this.mediaStream = stream;
      this.hasScreenCapturePermission = true;
      
      // Create video element to receive stream
      this.setupVideoCapture(stream);
      
      console.log('[Recording] Screen capture permission granted');
      return true;
    } catch (error) {
      console.warn('[Recording] Screen capture permission denied:', error);
      this.hasScreenCapturePermission = false;
      return false;
    }
  }

  /**
   * Setup video element for capturing frames
   */
  private setupVideoCapture(stream: MediaStream): void {
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = stream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.autoplay = true;

    // Handle stream ending (user stopped sharing)
    stream.getVideoTracks()[0].onended = () => {
      console.log('[Recording] Screen capture stream ended');
      this.hasScreenCapturePermission = false;
      this.mediaStream = null;
    };
  }

  /**
   * Start recording the screen for a session
   */
  async startRecording(sessionId: string, kioskId: string): Promise<boolean> {
    if (this.status === 'recording') {
      console.warn('[Recording] Already recording, stopping previous recording');
      await this.stopRecording();
    }

    try {
      console.log('[Recording] Starting screen recording for session:', sessionId);
      
      this.sessionId = sessionId;
      this.kioskId = kioskId;
      this.status = 'recording';
      this.startedAt = new Date();
      this.frames = [];
      this.errorMessage = null;

      // Initialize canvas for capturing
      this.initializeCanvas();

      // If we don't have screen capture permission, try to get it
      // or fall back to DOM snapshot
      if (!this.hasScreenCapturePermission || !this.mediaStream) {
        console.log('[Recording] No screen capture permission, using DOM snapshot fallback');
      } else {
        console.log('[Recording] Using screen capture API');
      }

      // Create recording record in database
      await this.createRecordingRecord();

      // Start webcam recording in parallel (non-blocking but log result)
      this.startWebcamRecording()
        .then((started) => {
          if (started) {
            console.log('[Recording] Webcam recording started successfully');
          } else {
            console.warn('[Recording] Webcam recording did not start (camera may be unavailable or permission denied)');
          }
        })
        .catch((error) => {
          console.error('[Recording] Webcam recording failed:', error);
        });

      // Start capturing frames at 1fps
      console.log('[Recording] Starting frame capture interval (1 FPS)...');
      this.captureInterval = setInterval(() => {
        this.captureFrame().catch((error) => {
          console.error('[Recording] Frame capture error in interval:', error);
        });
      }, FRAME_INTERVAL_MS);

      // Capture first frame immediately
      console.log('[Recording] Capturing initial frame...');
      await this.captureFrame();
      console.log('[Recording] Initial frame captured. Total frames:', this.frames.length);

      console.log('[Recording] Recording started successfully');
      return true;
    } catch (error) {
      console.error('[Recording] Failed to start recording:', error);
      this.status = 'failed';
      this.errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      return false;
    }
  }

  /**
   * Stop recording and process the video
   */
  async stopRecording(): Promise<string | null> {
    if (this.status !== 'recording') {
      console.warn('[Recording] Not currently recording');
      return null;
    }

    try {
      console.log('[Recording] Stopping recording, processing', this.frames.length, 'frames');
      
      // Stop frame capture
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = null;
      }

      this.status = 'processing';

      // Update database record
      await this.updateRecordingStatus('processing');

      // Encode frames to video
      if (this.frames.length === 0) {
        console.error('[Recording] CRITICAL: No frames captured!');
        console.error('[Recording] Status was:', this.status);
        console.error('[Recording] Canvas exists:', !!this.canvas);
        console.error('[Recording] Context exists:', !!this.ctx);
        console.error('[Recording] Has screen capture:', this.hasScreenCapturePermission);
        console.error('[Recording] Has media stream:', !!this.mediaStream);
        throw new Error('No frames captured - cannot create video');
      }

      console.log('[Recording] Encoding', this.frames.length, 'frames to video...');
      const videoBlob = await this.encodeVideo();
      
      if (!videoBlob) {
        throw new Error('Failed to encode video');
      }

      console.log('[Recording] Video encoded successfully, size:', videoBlob.size, 'bytes');

      this.status = 'uploading';
      await this.updateRecordingStatus('uploading');

      // Upload to storage
      const storageUrl = await this.uploadToStorage(videoBlob);

      // Generate thumbnail from first frame
      const thumbnailUrl = await this.uploadThumbnail();

      // Also stop and upload webcam recording (non-blocking)
      console.log('[Recording] Stopping webcam recording...');
      const webcamBlob = await this.stopWebcamRecording();
      if (webcamBlob && webcamBlob.size > 0) {
        console.log('[Recording] Uploading webcam video, size:', webcamBlob.size, 'bytes');
        try {
          const webcamUrl = await this.uploadWebcamToStorage(webcamBlob);
          console.log('[Recording] Webcam video uploaded successfully:', webcamUrl);
        } catch (error) {
          console.error('[Recording] Webcam upload failed:', error);
          // Don't throw - screen recording is more important
        }
      } else {
        console.warn('[Recording] No webcam recording to upload (blob is null or empty)');
      }

      // Update final status
      await this.finalizeRecording(storageUrl, thumbnailUrl, videoBlob.size);

      this.status = 'completed';
      console.log('[Recording] Recording completed successfully:', storageUrl);

      // Reset state (but keep screen capture permission)
      const url = storageUrl;
      this.resetSession();
      
      return url;
    } catch (error) {
      console.error('[Recording] Failed to stop recording:', error);
      this.status = 'failed';
      this.errorMessage = error instanceof Error ? error.message : 'Failed to process recording';
      await this.updateRecordingStatus('failed', this.errorMessage);
      this.resetSession();
      return null;
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    console.log('[Recording] Cancelling recording');
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Stop webcam recording
    if (this.webcamMediaRecorder && this.webcamMediaRecorder.state !== 'inactive') {
      this.stopWebcamRecording().catch(console.warn);
    }

    // Mark the recording as failed/cancelled (admin can delete from admin panel)
    if (this.recordingDbId) {
      this.updateRecordingStatus('failed', 'Recording cancelled').catch(console.error);
    }

    this.resetSession();
  }

  /**
   * Get current recording status
   */
  getStatus(): RecordingStatus {
    return this.status;
  }

  /**
   * Check if screen capture is available
   */
  get hasPermission(): boolean {
    return this.hasScreenCapturePermission && this.mediaStream !== null;
  }

  /**
   * Get recording metadata
   */
  getMetadata(): RecordingMetadata | null {
    if (!this.sessionId || !this.kioskId) return null;

    return {
      sessionId: this.sessionId,
      kioskId: this.kioskId,
      startedAt: this.startedAt || new Date(),
      endedAt: this.status !== 'recording' ? new Date() : undefined,
      duration: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      frameCount: this.frames.length,
      resolution: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
      status: this.status,
      errorMessage: this.errorMessage || undefined,
    };
  }

  /**
   * Check if recording is active
   */
  get isRecording(): boolean {
    return this.status === 'recording';
  }

  // ==================== Private Methods ====================

  private initializeCanvas(): void {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = TARGET_WIDTH;
      this.canvas.height = TARGET_HEIGHT;
      this.ctx = this.canvas.getContext('2d');
    }
  }

  private async captureFrame(): Promise<void> {
    if (this.status !== 'recording' || !this.ctx || !this.canvas) {
      console.warn('[Recording] Cannot capture frame - status:', this.status, 'ctx:', !!this.ctx, 'canvas:', !!this.canvas);
      return;
    }

    // Check max frames limit
    if (this.frames.length >= MAX_FRAMES) {
      console.warn('[Recording] Max frame limit reached, stopping recording');
      this.stopRecording();
      return;
    }

    try {
      let dataUrl: string | null = null;

      // Try screen capture first
      if (this.hasScreenCapturePermission && this.videoElement && this.mediaStream) {
        console.log('[Recording] Attempting screen capture from video stream...');
        dataUrl = await this.captureFromVideo();
        if (dataUrl) {
          console.log('[Recording] Screen capture successful');
        } else {
          console.warn('[Recording] Screen capture returned null');
        }
      }

      // Fall back to DOM snapshot
      if (!dataUrl) {
        console.log('[Recording] Screen capture not available, using html2canvas fallback');
        dataUrl = await this.captureDOMSnapshot();
        if (!dataUrl) {
          console.error('[Recording] html2canvas also failed - creating fallback placeholder');
          // Create a simple placeholder frame so we at least have something
          dataUrl = this.createPlaceholderFrame();
        }
      }
      
      if (dataUrl && dataUrl.length > 0) {
        this.frames.push({
          timestamp: Date.now(),
          dataUrl,
        });
        
        console.log(`[Recording] ✓ Captured frame ${this.frames.length} (size: ${dataUrl.length} chars)`);
        
        if (this.frames.length % 10 === 0) {
          console.log('[Recording] Progress: Captured', this.frames.length, 'frames');
        }
      } else {
        console.error('[Recording] Frame capture failed - dataUrl is null or empty');
        // Create placeholder so recording doesn't completely fail
        const placeholder = this.createPlaceholderFrame();
        if (placeholder) {
          this.frames.push({
            timestamp: Date.now(),
            dataUrl: placeholder,
          });
          console.log('[Recording] Added placeholder frame due to capture failure');
        }
      }
    } catch (error) {
      console.error('[Recording] Frame capture exception:', error);
      // Create placeholder frame even on error
      try {
        const placeholder = this.createPlaceholderFrame();
        if (placeholder) {
          this.frames.push({
            timestamp: Date.now(),
            dataUrl: placeholder,
          });
          console.log('[Recording] Added placeholder frame after error');
        }
      } catch (e) {
        console.error('[Recording] Even placeholder frame creation failed:', e);
      }
    }
  }

  /**
   * Create a simple placeholder frame when capture fails
   */
  private createPlaceholderFrame(): string | null {
    if (!this.ctx || !this.canvas) return null;

    try {
      // Clear canvas
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Draw placeholder text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 32px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Recording in Progress...', TARGET_WIDTH / 2, TARGET_HEIGHT / 2 - 40);
      
      this.ctx.font = '20px system-ui';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(`Frame ${this.frames.length + 1}`, TARGET_WIDTH / 2, TARGET_HEIGHT / 2);
      this.ctx.fillText(new Date().toLocaleTimeString(), TARGET_WIDTH / 2, TARGET_HEIGHT / 2 + 30);

      // Add recording overlay
      this.drawRecordingOverlay();

      return this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (error) {
      console.error('[Recording] Placeholder creation failed:', error);
      return null;
    }
  }

  /**
   * Capture frame from video stream (screen capture)
   */
  private async captureFromVideo(): Promise<string | null> {
    if (!this.videoElement || !this.ctx || !this.canvas) return null;

    try {
      // Make sure video is playing
      if (this.videoElement.readyState < 2) {
        await new Promise<void>((resolve) => {
          this.videoElement!.onloadeddata = () => resolve();
          setTimeout(resolve, 100); // Timeout fallback
        });
      }

      // Draw video frame to canvas
      this.ctx.drawImage(
        this.videoElement,
        0, 0,
        this.videoElement.videoWidth || TARGET_WIDTH,
        this.videoElement.videoHeight || TARGET_HEIGHT,
        0, 0,
        TARGET_WIDTH,
        TARGET_HEIGHT
      );

      // Add recording overlay
      this.drawRecordingOverlay();

      return this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (error) {
      console.error('[Recording] Video capture failed:', error);
      return null;
    }
  }

  /**
   * Draw recording indicator overlay
   */
  private drawRecordingOverlay(): void {
    if (!this.ctx) return;

    // Semi-transparent header bar
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, TARGET_WIDTH, 35);

    // Recording indicator (pulsing red dot)
    this.ctx.fillStyle = '#ef4444';
    this.ctx.beginPath();
    this.ctx.arc(18, 17, 6, 0, Math.PI * 2);
    this.ctx.fill();

    // REC text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    this.ctx.fillText('REC', 32, 22);

    // Session info
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '11px system-ui, -apple-system, sans-serif';
    this.ctx.fillText(`Session: ${this.sessionId?.substring(0, 8)}...`, 80, 22);

    // Timestamp
    const timestamp = new Date().toLocaleTimeString();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px system-ui, -apple-system, sans-serif';
    this.ctx.fillText(timestamp, TARGET_WIDTH - 75, 22);

    // Frame counter
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(`F:${this.frames.length + 1}`, TARGET_WIDTH - 140, 22);
  }

  /**
   * Fallback: Capture actual pixels from DOM using html2canvas
   * This provides pixel-perfect capture when Screen Capture API isn't available
   */
  private async captureDOMSnapshot(): Promise<string | null> {
    if (!this.ctx || !this.canvas) {
      console.warn('[Recording] Canvas not initialized for DOM snapshot');
      return null;
    }

    try {
      // Calculate scale to target resolution
      const scale = Math.min(TARGET_WIDTH / window.innerWidth, TARGET_HEIGHT / window.innerHeight);

      // Capture actual pixels from the DOM using html2canvas
      console.log('[Recording] Capturing DOM with html2canvas...', {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scale,
        hasBody: !!document.body,
      });

      const capturedCanvas = await html2canvas(document.body, {
        width: window.innerWidth,
        height: window.innerHeight,
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        removeContainer: false,
        onclone: (clonedDoc) => {
          console.log('[Recording] html2canvas onclone - document cloned');
          // Ensure any dynamically loaded content is rendered
          const clonedBody = clonedDoc.body;
          if (clonedBody) {
            clonedBody.style.visibility = 'visible';
          }
        },
      }).catch((error) => {
        console.error('[Recording] html2canvas promise rejected:', error);
        return null;
      });

      if (!capturedCanvas) {
        console.error('[Recording] html2canvas returned null canvas');
        return null;
      }

      if (capturedCanvas.width === 0 || capturedCanvas.height === 0) {
        console.error('[Recording] html2canvas returned canvas with zero dimensions');
        return null;
      }

      console.log('[Recording] html2canvas success - canvas size:', capturedCanvas.width, 'x', capturedCanvas.height);

      // Draw captured canvas to our target canvas at target resolution
      this.ctx.drawImage(capturedCanvas, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Add recording overlay on top
      this.drawRecordingOverlay();

      const dataUrl = this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      console.log('[Recording] DOM snapshot captured successfully, size:', dataUrl.length);
      return dataUrl;
    } catch (error) {
      console.error('[Recording] html2canvas capture failed:', error);
      // Return null so caller knows capture failed
      return null;
    }
  }


  private async encodeVideo(): Promise<Blob | null> {
    if (this.frames.length === 0) {
      console.warn('[Recording] No frames to encode');
      return null;
    }

    console.log('[Recording] Encoding', this.frames.length, 'frames to video');

    try {
      // Try MediaRecorder API
      return await this.encodeWithMediaRecorder();
    } catch (error) {
      console.warn('[Recording] MediaRecorder failed, using frame data fallback:', error);
      return await this.encodeAsFrameData();
    }
  }

  private async encodeWithMediaRecorder(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas || !this.ctx) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      // Check for MediaRecorder support
      if (typeof MediaRecorder === 'undefined') {
        reject(new Error('MediaRecorder not supported'));
        return;
      }

      const stream = this.canvas.captureStream(FRAME_RATE);
      
      // Find supported mime type
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1500000, // 1.5 Mbps
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('[Recording] Video encoded:', blob.size, 'bytes');
        resolve(blob);
      };

      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error'));
      };

      // Start recording
      mediaRecorder.start();

      // Play back frames to the canvas
      let frameIndex = 0;
      const playbackInterval = setInterval(() => {
        if (frameIndex >= this.frames.length) {
          clearInterval(playbackInterval);
          setTimeout(() => mediaRecorder.stop(), 100);
          return;
        }

        const frame = this.frames[frameIndex];
        const img = new Image();
        img.onload = () => {
          this.ctx?.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        };
        img.src = frame.dataUrl;
        frameIndex++;
      }, 1000 / FRAME_RATE);
    });
  }

  private async encodeAsFrameData(): Promise<Blob> {
    // Fallback: create a JSON blob with frame data
    const jsonData = JSON.stringify({
      type: 'session-recording-frames',
      sessionId: this.sessionId,
      frameRate: FRAME_RATE,
      resolution: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
      frames: this.frames.map(f => f.dataUrl),
      duration: this.frames.length / FRAME_RATE,
    });

    return new Blob([jsonData], { type: 'application/json' });
  }

  private async uploadToStorage(videoBlob: Blob): Promise<string> {
    console.log('[Recording] Preparing upload:', {
      blobSize: videoBlob.size,
      blobType: videoBlob.type,
      sessionId: this.sessionId,
      recordingId: this.recordingDbId,
    });

    if (!videoBlob || videoBlob.size === 0) {
      const errorMsg = 'Video blob is empty or invalid';
      console.error('[Recording]', errorMsg);
      await this.updateRecordingStatus('failed', errorMsg);
      throw new Error(errorMsg);
    }

    const formData = new FormData();
    const fileName = `${this.sessionId}_${Date.now()}.${videoBlob.type.includes('webm') ? 'webm' : 'json'}`;
    
    formData.append('file', videoBlob, fileName);
    formData.append('sessionId', this.sessionId || '');
    formData.append('kioskId', this.kioskId || '');
    formData.append('recordingId', this.recordingDbId || '');
    formData.append('type', 'video');

    console.log('[Recording] Uploading to /api/kiosk/session/recording/upload...');

    try {
      const response = await fetch('/api/kiosk/session/recording/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('[Recording] Upload response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        let errorData: any = {};
        
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `Upload failed: HTTP ${response.status}`;
        } catch {
          const text = await response.text().catch(() => 'Unknown error');
          errorMessage = `Upload failed: HTTP ${response.status} - ${text}`;
        }
        
        console.error('[Recording] Upload failed:', {
          status: response.status,
          error: errorMessage,
          details: errorData,
        });
        
        // Mark recording as failed with specific error
        await this.updateRecordingStatus('failed', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      console.log('[Recording] Upload response data:', {
        hasStorageUrl: !!data.storageUrl,
        hasStoragePath: !!data.storagePath,
        fileSize: data.fileSize,
      });
      
      // Verify we got a URL back
      if (!data.storageUrl) {
        const errorMsg = 'Upload succeeded but no URL returned';
        console.error('[Recording]', errorMsg, data);
        await this.updateRecordingStatus('failed', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('[Recording] Upload successful, storage URL:', data.storageUrl);
      return data.storageUrl;
    } catch (error) {
      console.error('[Recording] Upload exception:', error);
      if (error instanceof Error) {
        if (error.message !== 'Upload failed') {
          await this.updateRecordingStatus('failed', error.message);
        }
        throw error;
      }
      throw new Error('Unknown upload error');
    }
  }

  private async uploadThumbnail(): Promise<string | null> {
    if (this.frames.length === 0) return null;

    try {
      // Use first frame as thumbnail
      const thumbnailDataUrl = this.frames[0].dataUrl;
      
      // Convert data URL to blob
      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();

      const formData = new FormData();
      const fileName = `${this.sessionId}_thumb.jpg`;
      formData.append('file', blob, fileName);
      formData.append('sessionId', this.sessionId || '');
      formData.append('kioskId', this.kioskId || '');
      formData.append('recordingId', this.recordingDbId || '');
      formData.append('type', 'thumbnail');

      const uploadResponse = await fetch('/api/kiosk/session/recording/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) return null;

      const data = await uploadResponse.json();
      return data.storageUrl;
    } catch (error) {
      console.error('[Recording] Thumbnail upload failed:', error);
      return null;
    }
  }

  private async createRecordingRecord(): Promise<void> {
    const response = await fetch('/api/kiosk/session/recording/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        kioskId: this.kioskId,
        resolution: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
        frameRate: FRAME_RATE,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create recording record');
    }

    const data = await response.json();
    this.recordingDbId = data.recordingId;
  }

  private async updateRecordingStatus(status: string, errorMessage?: string): Promise<void> {
    if (!this.recordingDbId) return;

    try {
      await fetch('/api/kiosk/session/recording/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: this.recordingDbId,
          status,
          errorMessage,
        }),
      });
    } catch (error) {
      console.error('[Recording] Failed to update status:', error);
    }
  }

  private async finalizeRecording(
    storageUrl: string, 
    thumbnailUrl: string | null,
    fileSize: number
  ): Promise<void> {
    if (!this.recordingDbId) return;

    const duration = this.startedAt 
      ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
      : this.frames.length / FRAME_RATE;

    try {
      await fetch('/api/kiosk/session/recording/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: this.recordingDbId,
          sessionId: this.sessionId,
          storageUrl,
          thumbnailUrl,
          duration,
          fileSize,
          frameCount: this.frames.length,
        }),
      });
    } catch (error) {
      console.error('[Recording] Failed to finalize recording:', error);
    }
  }

  /**
   * Start webcam recording alongside screen recording
   */
  private async startWebcamRecording(): Promise<boolean> {
    try {
      console.log('[Recording] Requesting webcam access...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[Recording] getUserMedia API not available in this browser');
        return false;
      }

      // Request webcam access
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
        },
        audio: false, // No audio for privacy
      });

      console.log('[Recording] Webcam access granted');

      // Check if MediaRecorder is available
      if (typeof MediaRecorder === 'undefined') {
        console.warn('[Recording] MediaRecorder API not available');
        this.webcamStream.getTracks().forEach(track => track.stop());
        this.webcamStream = null;
        return false;
      }

      // Find supported mime type
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      console.log('[Recording] Using MediaRecorder mime type:', mimeType);

      this.webcamMediaRecorder = new MediaRecorder(this.webcamStream, {
        mimeType,
        videoBitsPerSecond: 500000, // 500 kbps for webcam
      });

      this.webcamChunks = [];

      this.webcamMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.webcamChunks.push(event.data);
          console.log('[Recording] Webcam chunk received, size:', event.data.size);
        }
      };

      this.webcamMediaRecorder.onerror = (event) => {
        console.error('[Recording] MediaRecorder error:', event);
      };

      // Start recording in 5-second intervals
      this.webcamMediaRecorder.start(5000);
      console.log('[Recording] Webcam MediaRecorder started, state:', this.webcamMediaRecorder.state);
      return true;
    } catch (error) {
      console.error('[Recording] Webcam access denied or unavailable:', error);
      if (error instanceof Error) {
        console.error('[Recording] Error details:', error.message, error.name);
      }
      // Clean up on error
      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach(track => track.stop());
        this.webcamStream = null;
      }
      return false;
    }
  }

  /**
   * Stop webcam recording and return blob
   */
  private async stopWebcamRecording(): Promise<Blob | null> {
    if (!this.webcamMediaRecorder || this.webcamMediaRecorder.state === 'inactive') {
      // Clean up stream if recorder wasn't started
      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach(track => track.stop());
        this.webcamStream = null;
      }
      return null;
    }

    return new Promise((resolve) => {
      this.webcamMediaRecorder!.onstop = () => {
        const blob = new Blob(this.webcamChunks, { type: 'video/webm' });
        
        // Clean up
        this.webcamStream?.getTracks().forEach(track => track.stop());
        this.webcamStream = null;
        this.webcamMediaRecorder = null;
        this.webcamChunks = [];
        
        console.log('[Recording] Webcam recording stopped, size:', blob.size);
        resolve(blob);
      };

      try {
        if (this.webcamMediaRecorder && this.webcamMediaRecorder.state === 'recording') {
          this.webcamMediaRecorder.stop();
        } else {
          // Already stopped, resolve immediately
          resolve(null);
        }
      } catch (error) {
        console.warn('[Recording] Error stopping webcam recorder:', error);
        resolve(null);
      }
    });
  }

  /**
   * Upload webcam recording to storage
   */
  private async uploadWebcamToStorage(webcamBlob: Blob): Promise<string> {
    const formData = new FormData();
    const fileName = `${this.sessionId}_webcam_${Date.now()}.webm`;
    formData.append('file', webcamBlob, fileName);
    formData.append('sessionId', this.sessionId || '');
    formData.append('kioskId', this.kioskId || '');
    formData.append('recordingId', this.recordingDbId || '');
    formData.append('type', 'webcam');

    try {
      const response = await fetch('/api/kiosk/session/recording/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Webcam upload failed');
      }

      const data = await response.json();
      console.log('[Recording] Webcam video uploaded:', data.storageUrl);
      return data.storageUrl;
    } catch (error) {
      console.error('[Recording] Webcam upload failed:', error);
      throw error;
    }
  }

  private resetSession(): void {
    this.sessionId = null;
    this.kioskId = null;
    this.status = 'idle';
    this.startedAt = null;
    this.frames = [];
    this.recordingDbId = null;
    this.errorMessage = null;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Stop webcam recording if active
    if (this.webcamMediaRecorder && this.webcamMediaRecorder.state !== 'inactive') {
      this.stopWebcamRecording().catch(console.warn);
    } else if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
    
    // Don't reset mediaStream or hasScreenCapturePermission - keep permission for next recording
  }
}

// ==================== Singleton Export ====================

export const sessionRecordingService = new SessionRecordingService();
