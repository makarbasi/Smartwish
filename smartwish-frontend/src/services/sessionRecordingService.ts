/**
 * Session Recording Service
 * 
 * Captures screen recordings of kiosk sessions at 1 FPS for admin review.
 * Uses Screen Capture API for actual pixel capture, with DOM snapshot fallback.
 */

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

      // Start capturing frames at 1fps
      this.captureInterval = setInterval(() => {
        this.captureFrame();
      }, FRAME_INTERVAL_MS);

      // Capture first frame immediately
      await this.captureFrame();

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
      const videoBlob = await this.encodeVideo();
      
      if (!videoBlob) {
        throw new Error('Failed to encode video');
      }

      this.status = 'uploading';
      await this.updateRecordingStatus('uploading');

      // Upload to storage
      const storageUrl = await this.uploadToStorage(videoBlob);

      // Generate thumbnail from first frame
      const thumbnailUrl = await this.uploadThumbnail();

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
    if (this.status !== 'recording' || !this.ctx || !this.canvas) return;

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
        dataUrl = await this.captureFromVideo();
      }

      // Fall back to DOM snapshot
      if (!dataUrl) {
        dataUrl = await this.captureDOMSnapshot();
      }
      
      if (dataUrl) {
        this.frames.push({
          timestamp: Date.now(),
          dataUrl,
        });
        
        if (this.frames.length % 10 === 0) {
          console.log('[Recording] Captured frame', this.frames.length);
        }
      }
    } catch (error) {
      console.error('[Recording] Frame capture error:', error);
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
   * Fallback: Capture a DOM-based snapshot
   * Creates a visual representation when screen capture isn't available
   */
  private async captureDOMSnapshot(): Promise<string | null> {
    if (!this.ctx || !this.canvas) return null;

    try {
      // Create a gradient background
      const gradient = this.ctx.createLinearGradient(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e1b4b');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Calculate scale
      const scaleX = TARGET_WIDTH / window.innerWidth;
      const scaleY = TARGET_HEIGHT / window.innerHeight;
      const scale = Math.min(scaleX, scaleY);
      const offsetY = 45; // Leave space for header

      // Draw elements
      this.drawPageElements(scale, offsetY);

      // Draw header
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      this.ctx.fillRect(0, 0, TARGET_WIDTH, 45);

      // Page title
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(document.title || 'SmartWish Kiosk', 70, 20);

      // Page path
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '11px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(window.location.pathname, 70, 36);

      // Recording indicator
      this.ctx.fillStyle = '#ef4444';
      this.ctx.beginPath();
      this.ctx.arc(18, 22, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px system-ui';
      this.ctx.fillText('REC', 32, 26);

      // Timestamp
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '12px system-ui';
      this.ctx.fillText(new Date().toLocaleTimeString(), TARGET_WIDTH - 75, 22);

      // Frame counter
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '11px system-ui';
      this.ctx.fillText(`Frame ${this.frames.length + 1}`, TARGET_WIDTH - 160, 22);
      
      // DOM Snapshot indicator
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = '10px system-ui';
      this.ctx.fillText('(DOM Snapshot)', TARGET_WIDTH - 100, 38);

      return this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (error) {
      console.error('[Recording] DOM snapshot failed:', error);
      return null;
    }
  }

  /**
   * Draw visible page elements on canvas
   */
  private drawPageElements(scale: number, offsetY: number = 0): void {
    if (!this.ctx) return;

    // Query important visible elements
    const selectors = [
      'button', 'a', 'img', 'input', 'textarea', 'select',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '[role="button"]', '[role="link"]',
      '.card', '.tile', '[class*="Card"]', '[class*="card"]'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));

    elements.forEach(element => {
      try {
        const rect = element.getBoundingClientRect();
        
        // Skip elements outside viewport or too small
        if (rect.width < 10 || rect.height < 10) return;
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) return;
        if (rect.bottom < 0 || rect.right < 0) return;

        const x = rect.left * scale;
        const y = rect.top * scale + offsetY;
        const width = rect.width * scale;
        const height = rect.height * scale;

        // Clamp to canvas bounds
        if (y + height > TARGET_HEIGHT - 20) return;

        const tagName = element.tagName.toLowerCase();
        
        // Draw element representation based on type
        if (tagName === 'img') {
          this.ctx!.fillStyle = 'rgba(59, 130, 246, 0.4)';
          this.ctx!.fillRect(x, y, width, height);
          this.ctx!.strokeStyle = '#3b82f6';
          this.ctx!.lineWidth = 1;
          this.ctx!.strokeRect(x, y, width, height);
          // Image icon
          this.ctx!.fillStyle = '#60a5fa';
          this.ctx!.font = '10px system-ui';
          this.ctx!.fillText('🖼️', x + width/2 - 6, y + height/2 + 4);
        } else if (tagName === 'button' || element.getAttribute('role') === 'button') {
          this.ctx!.fillStyle = 'rgba(99, 102, 241, 0.5)';
          this.ctx!.fillRect(x, y, width, height);
          this.ctx!.strokeStyle = '#818cf8';
          this.ctx!.lineWidth = 2;
          this.ctx!.strokeRect(x, y, width, height);
          // Draw button text
          const text = element.textContent?.trim() || '';
          if (text && width > 30) {
            this.ctx!.fillStyle = '#e0e7ff';
            this.ctx!.font = `bold ${Math.min(13, height * 0.35)}px system-ui`;
            this.ctx!.fillText(this.truncateText(text, Math.floor(width / 7)), x + 6, y + height / 2 + 4);
          }
        } else if (tagName === 'a') {
          this.ctx!.fillStyle = 'rgba(34, 197, 94, 0.3)';
          this.ctx!.fillRect(x, y, width, height);
          this.ctx!.strokeStyle = '#4ade80';
          this.ctx!.lineWidth = 1;
          this.ctx!.strokeRect(x, y, width, height);
          const text = element.textContent?.trim() || '';
          if (text && width > 20) {
            this.ctx!.fillStyle = '#86efac';
            this.ctx!.font = `${Math.min(11, height * 0.4)}px system-ui`;
            this.ctx!.fillText(this.truncateText(text, Math.floor(width / 6)), x + 4, y + height / 2 + 3);
          }
        } else if (tagName === 'input' || tagName === 'textarea') {
          this.ctx!.fillStyle = 'rgba(251, 191, 36, 0.3)';
          this.ctx!.fillRect(x, y, width, height);
          this.ctx!.strokeStyle = '#fcd34d';
          this.ctx!.lineWidth = 1;
          this.ctx!.strokeRect(x, y, width, height);
        } else if (tagName.match(/^h[1-6]$/)) {
          const text = element.textContent?.trim() || '';
          if (text) {
            this.ctx!.fillStyle = '#f8fafc';
            const fontSize = tagName === 'h1' ? 18 : tagName === 'h2' ? 15 : 12;
            this.ctx!.font = `bold ${fontSize}px system-ui`;
            this.ctx!.fillText(this.truncateText(text, 45), x, y + height / 2 + fontSize / 3);
          }
        } else if (element.classList?.toString().match(/card|Card|tile|Tile/i)) {
          this.ctx!.fillStyle = 'rgba(148, 163, 184, 0.2)';
          this.ctx!.fillRect(x, y, width, height);
          this.ctx!.strokeStyle = 'rgba(148, 163, 184, 0.5)';
          this.ctx!.lineWidth = 1;
          this.ctx!.strokeRect(x, y, width, height);
        }
      } catch {
        // Skip elements that throw errors
      }
    });
  }

  /**
   * Truncate text to a maximum length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
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
    const formData = new FormData();
    const fileName = `${this.sessionId}_${Date.now()}.${videoBlob.type.includes('webm') ? 'webm' : 'json'}`;
    formData.append('file', videoBlob, fileName);
    formData.append('sessionId', this.sessionId || '');
    formData.append('kioskId', this.kioskId || '');
    formData.append('recordingId', this.recordingDbId || '');

    const response = await fetch('/api/kiosk/session/recording/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return data.storageUrl;
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
    
    // Don't reset mediaStream or hasScreenCapturePermission - keep permission for next recording
  }
}

// ==================== Singleton Export ====================

export const sessionRecordingService = new SessionRecordingService();
