/**
 * Session Recording Service
 * 
 * Captures screen recordings of kiosk sessions at 1 FPS for admin review.
 * Uses Canvas API for screenshot capture and MediaRecorder for video encoding.
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
const JPEG_QUALITY = 0.6; // Balance between quality and size
const TARGET_WIDTH = 1280; // Downscale for smaller file size
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

  constructor() {
    // Initialize canvas lazily
  }

  // ==================== Public API ====================

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

      // Create recording record in database
      await this.createRecordingRecord();

      // Start capturing frames at 1fps
      this.captureInterval = setInterval(() => {
        this.captureFrame();
      }, FRAME_INTERVAL_MS);

      // Capture first frame immediately
      this.captureFrame();

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

      // Reset state
      const url = storageUrl;
      this.reset();
      
      return url;
    } catch (error) {
      console.error('[Recording] Failed to stop recording:', error);
      this.status = 'failed';
      this.errorMessage = error instanceof Error ? error.message : 'Failed to process recording';
      await this.updateRecordingStatus('failed', this.errorMessage);
      this.reset();
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

    // Delete the database record if it exists
    if (this.recordingDbId) {
      this.deleteRecordingRecord().catch(console.error);
    }

    this.reset();
  }

  /**
   * Get current recording status
   */
  getStatus(): RecordingStatus {
    return this.status;
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
      // Capture screenshot of current page state
      const dataUrl = await this.captureScreenshot();
      
      if (dataUrl) {
        this.frames.push({
          timestamp: Date.now(),
          dataUrl,
        });
      }
    } catch (error) {
      console.error('[Recording] Frame capture error:', error);
    }
  }

  private async captureScreenshot(): Promise<string | null> {
    if (!this.ctx || !this.canvas) return null;

    // Use DOM snapshot directly - html2canvas doesn't support oklch() colors
    // which are used throughout the app via Tailwind CSS
    return await this.captureDOMSnapshot();
  }

  /**
   * Capture a DOM-based snapshot
   * Creates a visual representation of the current page state with element positions
   */
  private async captureDOMSnapshot(): Promise<string | null> {
    if (!this.ctx || !this.canvas) return null;

    try {
      // Create a gradient background matching the app theme
      const gradient = this.ctx.createLinearGradient(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      gradient.addColorStop(0, '#0f0f23');
      gradient.addColorStop(1, '#1a1a2e');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Calculate scale factor
      const scaleX = TARGET_WIDTH / window.innerWidth;
      const scaleY = TARGET_HEIGHT / window.innerHeight;
      const scale = Math.min(scaleX, scaleY);

      // Draw visual representation of page elements
      this.drawPageElements(scale);

      // Draw header overlay with page info
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.fillRect(0, 0, TARGET_WIDTH, 60);

      // Draw page title
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      const pageTitle = document.title || 'SmartWish Kiosk';
      this.ctx.fillText(this.truncateText(pageTitle, 50), 20, 35);

      // Draw current path
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '14px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(window.location.pathname, 20, 52);

      // Draw recording indicator (top right)
      this.ctx.fillStyle = '#ef4444';
      this.ctx.beginPath();
      this.ctx.arc(TARGET_WIDTH - 25, 30, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#fca5a5';
      this.ctx.font = 'bold 11px system-ui';
      this.ctx.fillText('● REC', TARGET_WIDTH - 70, 35);

      // Draw timestamp
      const timestamp = new Date().toLocaleTimeString();
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '12px system-ui';
      this.ctx.fillText(timestamp, TARGET_WIDTH - 80, 52);

      // Draw footer with frame info
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      this.ctx.fillRect(0, TARGET_HEIGHT - 30, TARGET_WIDTH, 30);
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '11px monospace';
      this.ctx.fillText(
        `Frame ${this.frames.length + 1} | Session: ${this.sessionId?.substring(0, 8)}... | ${window.innerWidth}x${window.innerHeight}`,
        20,
        TARGET_HEIGHT - 10
      );

      return this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (error) {
      console.error('[Recording] DOM snapshot failed:', error);
      return await this.captureViewportFallback();
    }
  }

  /**
   * Draw visual representations of page elements
   */
  private drawPageElements(scale: number): void {
    if (!this.ctx) return;

    // Get important elements to represent visually
    const elementsToCapture = [
      ...Array.from(document.querySelectorAll('button, a, img, h1, h2, h3, input, [role="button"]')),
      ...Array.from(document.querySelectorAll('.card, [class*="card"], [class*="Card"]')),
    ].slice(0, 100); // Limit to prevent performance issues

    elementsToCapture.forEach((element) => {
      try {
        const rect = element.getBoundingClientRect();
        
        // Skip elements outside viewport or too small
        if (rect.width < 10 || rect.height < 10) return;
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) return;
        if (rect.bottom < 0 || rect.right < 0) return;

        const x = rect.left * scale;
        const y = rect.top * scale + 60; // Offset for header
        const width = rect.width * scale;
        const height = rect.height * scale;

        // Clamp to canvas bounds
        if (y + height > TARGET_HEIGHT - 30) return;

        const tagName = element.tagName.toLowerCase();
        
        // Draw element representation based on type
        if (tagName === 'img') {
          // Image placeholder
          this.ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
          this.ctx.fillRect(x, y, width, height);
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x, y, width, height);
          // Draw image icon
          this.ctx.fillStyle = '#3b82f6';
          this.ctx.font = '10px system-ui';
          this.ctx.fillText('🖼', x + width/2 - 5, y + height/2 + 3);
        } else if (tagName === 'button' || element.getAttribute('role') === 'button') {
          // Button
          this.ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
          this.ctx.fillRect(x, y, width, height);
          this.ctx.strokeStyle = '#6366f1';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x, y, width, height);
          // Draw button text
          const text = element.textContent?.trim() || '';
          if (text && width > 30) {
            this.ctx.fillStyle = '#e0e7ff';
            this.ctx.font = `${Math.min(12, height * 0.5)}px system-ui`;
            this.ctx.fillText(this.truncateText(text, Math.floor(width / 6)), x + 4, y + height/2 + 4);
          }
        } else if (tagName === 'a') {
          // Link
          this.ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
          this.ctx.fillRect(x, y, width, height);
          this.ctx.strokeStyle = '#22c55e';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x, y, width, height);
        } else if (tagName === 'input') {
          // Input field
          this.ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
          this.ctx.fillRect(x, y, width, height);
          this.ctx.strokeStyle = '#fbbf24';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x, y, width, height);
        } else if (tagName.match(/^h[1-3]$/)) {
          // Headings
          const text = element.textContent?.trim() || '';
          if (text) {
            this.ctx.fillStyle = '#f8fafc';
            const fontSize = tagName === 'h1' ? 18 : tagName === 'h2' ? 14 : 12;
            this.ctx.font = `bold ${fontSize}px system-ui`;
            this.ctx.fillText(this.truncateText(text, 60), x, y + height/2 + fontSize/3);
          }
        } else if (element.classList?.toString().includes('card') || element.classList?.toString().includes('Card')) {
          // Cards
          this.ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
          this.ctx.fillRect(x, y, width, height);
          this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x, y, width, height);
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

  private async captureViewportFallback(): Promise<string | null> {
    if (!this.ctx || !this.canvas) return null;

    try {
      // Clear canvas with dark background
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Draw timestamp
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '24px sans-serif';
      this.ctx.fillText(
        `Session: ${this.sessionId?.substring(0, 8)}...`,
        20, 40
      );
      this.ctx.fillText(
        `Frame ${this.frames.length + 1} - ${new Date().toLocaleTimeString()}`,
        20, 80
      );
      this.ctx.fillText(
        `Page: ${window.location.pathname}`,
        20, 120
      );

      // Draw visual indicator of activity
      const activityIndicator = document.querySelector('[data-recording-indicator]');
      if (activityIndicator) {
        this.ctx.fillStyle = '#22c55e';
        this.ctx.beginPath();
        this.ctx.arc(TARGET_WIDTH - 40, 40, 15, 0, Math.PI * 2);
        this.ctx.fill();
      }

      return this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (error) {
      console.error('[Recording] Fallback capture error:', error);
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
      // Try MediaRecorder API first (most efficient)
      return await this.encodeWithMediaRecorder();
    } catch (error) {
      console.warn('[Recording] MediaRecorder failed, using fallback:', error);
      // Fallback to canvas-based encoding (creates a slideshow-style video)
      return await this.encodeWithCanvasFallback();
    }
  }

  private async encodeWithMediaRecorder(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      const stream = this.canvas.captureStream(FRAME_RATE);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 500000, // 500 kbps
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error('MediaRecorder error'));
      };

      // Start recording and play back frames
      mediaRecorder.start();

      let frameIndex = 0;
      const playbackInterval = setInterval(() => {
        if (frameIndex >= this.frames.length) {
          clearInterval(playbackInterval);
          mediaRecorder.stop();
          return;
        }

        const frame = this.frames[frameIndex];
        const img = new Image();
        img.onload = () => {
          if (this.ctx) {
            this.ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
          }
        };
        img.src = frame.dataUrl;
        frameIndex++;
      }, FRAME_INTERVAL_MS);
    });
  }

  private async encodeWithCanvasFallback(): Promise<Blob> {
    // Create a simple webm by concatenating frame data
    // This is a simplified fallback that creates a slideshow-like video
    
    const frameDataUrls = this.frames.map(f => f.dataUrl);
    
    // For simplicity, we'll just create a blob with the frames
    // In a real implementation, you might want to use a library like whammy.js
    // or ffmpeg.wasm for proper video encoding
    
    const jsonData = JSON.stringify({
      type: 'session-recording-frames',
      sessionId: this.sessionId,
      frameRate: FRAME_RATE,
      resolution: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
      frames: frameDataUrls,
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

  private async deleteRecordingRecord(): Promise<void> {
    if (!this.recordingDbId) return;

    try {
      await fetch(`/api/kiosk/session/recording/${this.recordingDbId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('[Recording] Failed to delete recording record:', error);
    }
  }

  private reset(): void {
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
  }
}

// ==================== Singleton Export ====================

export const sessionRecordingService = new SessionRecordingService();

