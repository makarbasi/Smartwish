/**
 * Kiosk Session Tracking Service
 * 
 * Handles event collection, batching, and sending to the backend.
 * Designed for minimal performance impact with batched network calls.
 */

import type {
  SessionEventType,
  InteractionZone,
  SessionEventDetails,
  EventCoordinates,
  LogEventRequest,
  SessionOutcome,
} from '@/types/kioskSession';

// ==================== Configuration ====================

// Increased from 5s to 15s to reduce request volume
// Events are batched and don't need real-time delivery
const BATCH_INTERVAL_MS = 15000; // Send events every 15 seconds (was 5s)
const MAX_BATCH_SIZE = 100; // Maximum events per batch (increased to accommodate longer intervals)
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // Increased from 1s to reduce retry spam

// ==================== Types ====================

interface QueuedEvent {
  eventType: SessionEventType;
  page: string;
  zone?: InteractionZone;
  details?: SessionEventDetails;
  coordinates?: EventCoordinates;
  timestamp: string;
}

interface ConsoleLogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}

type SessionState = 'idle' | 'active' | 'ending';

// ==================== Storage Keys ====================

const SESSION_STORAGE_KEY = 'kiosk_session_state';

interface PersistedSessionState {
  sessionId: string;
  kioskId: string;
  state: SessionState;
  currentPage: string;
  pageEnteredAt: number;
  persistedAt: number; // Timestamp when state was saved
}

// Maximum age of persisted session (30 minutes)
const MAX_SESSION_AGE_MS = 30 * 60 * 1000;

// ==================== Service Class ====================

class KioskSessionService {
  private sessionId: string | null = null;
  private kioskId: string | null = null;
  private eventQueue: QueuedEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private state: SessionState = 'idle';
  private currentPage: string = '';
  private pageEnteredAt: number = 0;
  private isOnline: boolean = true;
  private offlineQueue: QueuedEvent[] = [];

  // Console log capture
  private consoleLogs: ConsoleLogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  private originalWebSocket: typeof WebSocket | null = null;

  constructor() {
    // Recover session state from storage (survives HMR in dev mode)
    this.recoverSessionState();
  }

  /**
   * Persist session state to sessionStorage (survives HMR)
   */
  private persistSessionState(): void {
    if (this.state === 'active' && this.sessionId && this.kioskId) {
      const state: PersistedSessionState = {
        sessionId: this.sessionId,
        kioskId: this.kioskId,
        state: this.state,
        currentPage: this.currentPage,
        pageEnteredAt: this.pageEnteredAt,
        persistedAt: Date.now(),
      };
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
        console.log('[SessionService] Persisted session state:', this.sessionId);
      } catch (error) {
        console.warn('[SessionService] Failed to persist session state:', error);
      }
    }
  }

  /**
   * Recover session state from sessionStorage (after HMR)
   */
  private recoverSessionState(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const state: PersistedSessionState = JSON.parse(stored);

        // Check if session is too old
        const age = Date.now() - (state.persistedAt || 0);
        if (age > MAX_SESSION_AGE_MS) {
          console.log('[SessionService] Persisted session too old, clearing');
          this.clearPersistedState();
          return;
        }

        // Only recover if session was active
        if (state.state === 'active' && state.sessionId) {
          this.sessionId = state.sessionId;
          this.kioskId = state.kioskId;
          this.state = 'active';
          this.currentPage = state.currentPage;
          this.pageEnteredAt = state.pageEnteredAt;

          // Restart batch timer
          this.startBatchTimer();

          console.log('[SessionService] Recovered session state:', this.sessionId);
        }
      }
    } catch (error) {
      console.warn('[SessionService] Failed to recover session state:', error);
      // Clear potentially corrupted state
      this.clearPersistedState();
    }
  }

  /**
   * Clear persisted session state
   */
  private clearPersistedState(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('[SessionService] Failed to clear persisted state:', error);
    }
  }

  // ==================== Session Lifecycle ====================

  /**
   * Start a new tracking session
   */
  async startSession(kioskId: string): Promise<string | null> {
    if (this.state === 'active') {
      console.warn('[SessionService] Session already active, ending previous session');
      await this.endSession('abandoned');
    }

    this.kioskId = kioskId;
    this.state = 'active';
    this.eventQueue = [];
    this.currentPage = '';
    this.pageEnteredAt = Date.now();

    try {
      const response = await fetch('/api/kiosk/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioskId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      this.sessionId = data.sessionId;

      // Start batch timer
      this.startBatchTimer();

      // Track session start event
      this.trackEvent('session_start', window.location.pathname, undefined, {
        kioskId,
      });

      console.log('[SessionService] Session started:', this.sessionId);

      // Trigger recording on the LOCAL print agent (runs on same machine as kiosk browser)
      // This ONLY works because the browser is on the kiosk machine - not from the server
      if (data.recording?.enabled) {
        console.log('[SessionService] Triggering local recording for session:', this.sessionId);
        this.triggerLocalRecording(this.sessionId!, data.recording);
      }

      // Start capturing console logs
      this.startConsoleCapture();

      // Persist state to survive HMR
      this.persistSessionState();

      return this.sessionId;
    } catch (error) {
      console.error('[SessionService] Failed to start session:', error);
      this.state = 'idle';
      return null;
    }
  }

  /**
   * Trigger recording on the local print agent
   * This is called from the kiosk browser (which runs on the local machine)
   * so it CAN reach localhost:8766 - unlike server-side code on Vercel
   */
  private triggerLocalRecording(sessionId: string, recordingConfig: { config?: any }) {
    const pairingPort = 8766; // Default pairing server port

    fetch(`http://localhost:${pairingPort}/session/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        kioskConfig: {
          recording: recordingConfig.config || {},
        },
      }),
    })
      .then((res) => {
        if (res.ok) {
          console.log('[SessionService] Local recording started successfully');
        } else {
          console.warn('[SessionService] Local print agent returned error:', res.status);
        }
      })
      .catch((err) => {
        // If local agent is not running, that's okay - recording just won't happen
        console.warn('[SessionService] Could not reach local print agent:', err.message);
        console.log('[SessionService] Recording skipped (print agent may not be running)');
      });
  }

  /**
   * Stop recording on the local print agent
   */
  private stopLocalRecording(sessionId: string) {
    const pairingPort = 8766;

    fetch(`http://localhost:${pairingPort}/session/recording/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => {
        if (res.ok) {
          console.log('[SessionService] Local recording stopped successfully');
        }
      })
      .catch((err) => {
        console.warn('[SessionService] Could not stop local recording:', err.message);
      });
  }

  /**
   * Start capturing console logs
   * Overrides console.log/info/warn/error to capture all output
   * Also captures global errors, unhandled rejections, and WebSocket errors
   */
  private startConsoleCapture(): void {
    if (this.originalConsole) {
      return; // Already capturing
    }

    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // Clear previous logs
    this.consoleLogs = [];

    // Create capture wrapper
    const captureLog = (level: 'log' | 'info' | 'warn' | 'error', originalFn: (...args: unknown[]) => void) => {
      return (...args: unknown[]) => {
        // Call original console method
        originalFn(...args);

        // Capture the log entry
        const message = args
          .map((arg) => {
            if (typeof arg === 'string') return arg;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ');

        this.consoleLogs.push({
          timestamp: new Date().toISOString(),
          level,
          message,
        });
      };
    };

    // Override console methods
    console.log = captureLog('log', this.originalConsole.log);
    console.info = captureLog('info', this.originalConsole.info);
    console.warn = captureLog('warn', this.originalConsole.warn);
    console.error = captureLog('error', this.originalConsole.error);

    // Add global error handler for uncaught errors
    this.errorHandler = (event: ErrorEvent) => {
      this.consoleLogs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[Uncaught Error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      });
    };
    window.addEventListener('error', this.errorHandler);

    // Add unhandled promise rejection handler
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      let reason = 'Unknown reason';
      try {
        reason = event.reason?.message || event.reason?.toString() || JSON.stringify(event.reason);
      } catch {
        reason = String(event.reason);
      }
      this.consoleLogs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[Unhandled Promise Rejection] ${reason}`,
      });
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    // Patch WebSocket to capture connection errors
    if (typeof window !== 'undefined' && window.WebSocket) {
      this.originalWebSocket = window.WebSocket;
      const self = this;
      const OriginalWebSocket = window.WebSocket;

      // Create a patched WebSocket class
      window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
        const ws = new OriginalWebSocket(url, protocols);

        // Capture WebSocket errors
        ws.addEventListener('error', () => {
          self.consoleLogs.push({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `[WebSocket Error] Connection to '${url}' failed`,
          });
        });

        return ws;
      } as unknown as typeof WebSocket;

      // Copy static properties
      Object.assign(window.WebSocket, OriginalWebSocket);
      window.WebSocket.prototype = OriginalWebSocket.prototype;
    }
  }

  /**
   * Stop capturing console logs and restore original methods
   */
  private stopConsoleCapture(): void {
    if (!this.originalConsole) {
      return; // Not capturing
    }

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;

    this.originalConsole = null;

    // Remove global error handlers
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }

    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }

    // Restore original WebSocket
    if (this.originalWebSocket) {
      window.WebSocket = this.originalWebSocket;
      this.originalWebSocket = null;
    }
  }

  /**
   * Send captured console logs to the local print agent
   */
  private sendConsoleLogs(sessionId: string, kioskId: string): void {
    if (this.consoleLogs.length === 0) {
      return;
    }

    const pairingPort = 8766;

    const payload = {
      sessionId,
      kioskId,
      capturedAt: new Date().toISOString(),
      logs: this.consoleLogs,
    };

    fetch(`http://localhost:${pairingPort}/session/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) {
          console.log(`[SessionService] Sent ${this.consoleLogs.length} console logs to local agent`);
        } else {
          console.warn('[SessionService] Failed to send console logs:', res.status);
        }
      })
      .catch((err) => {
        console.warn('[SessionService] Could not send console logs:', err.message);
      });

    // Clear logs after sending
    this.consoleLogs = [];
  }

  /**
   * End the current session
   */
  async endSession(outcome: SessionOutcome): Promise<void> {
    if (this.state !== 'active' || !this.sessionId) {
      console.warn('[SessionService] No active session to end');
      return;
    }

    this.state = 'ending';

    // Track session end event
    this.trackEvent('session_end', this.currentPage, undefined, { outcome });

    // Stop console capture and send logs to local agent (before stopping recording)
    this.stopConsoleCapture();
    if (this.sessionId && this.kioskId) {
      this.sendConsoleLogs(this.sessionId, this.kioskId);
    }

    // Stop recording on the local print agent (before we clear sessionId)
    if (this.sessionId) {
      this.stopLocalRecording(this.sessionId);
    }

    // Flush remaining events
    await this.flushEvents();

    // Stop batch timer
    this.stopBatchTimer();

    try {
      const response = await fetch('/api/kiosk/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          outcome,
        }),
      });

      if (!response.ok) {
        console.error('[SessionService] Failed to end session');
      }
    } catch (error) {
      console.error('[SessionService] Error ending session:', error);
    }

    console.log('[SessionService] Session ended:', this.sessionId, 'Outcome:', outcome);

    // Clear persisted state
    this.clearPersistedState();

    // Reset state
    this.sessionId = null;
    this.kioskId = null;
    this.state = 'idle';
    this.eventQueue = [];
  }

  /**
   * Handle session timeout (from inactivity)
   */
  async handleTimeout(): Promise<void> {
    console.log('[SessionService] handleTimeout called, current state:', this.state, 'sessionId:', this.sessionId);

    if (this.state !== 'active') {
      console.log('[SessionService] handleTimeout skipped - session not active');
      return;
    }

    console.log('[SessionService] Processing timeout, ending session as abandoned');
    this.trackEvent('session_timeout', this.currentPage);

    // Note: Recording stop is handled by backend/Python automatically when session ends

    await this.endSession('abandoned');
  }

  // ==================== Event Tracking ====================

  /**
   * Track a single event
   */
  trackEvent(
    eventType: SessionEventType,
    page: string,
    zone?: InteractionZone,
    details?: SessionEventDetails,
    coordinates?: EventCoordinates
  ): void {
    if (this.state !== 'active' && eventType !== 'session_start') {
      console.warn('[SessionService] Cannot track event - no active session');
      return;
    }

    const event: QueuedEvent = {
      eventType,
      page,
      zone,
      details,
      coordinates,
      timestamp: new Date().toISOString(),
    };

    if (this.isOnline) {
      this.eventQueue.push(event);

      // Flush immediately if we hit max batch size
      if (this.eventQueue.length >= MAX_BATCH_SIZE) {
        this.flushEvents();
      }
    } else {
      // Store offline for later sync
      this.offlineQueue.push(event);
    }
  }

  /**
   * Track page navigation
   */
  trackPageView(page: string): void {
    // Track exit from previous page
    if (this.currentPage && this.currentPage !== page) {
      const timeOnPage = Date.now() - this.pageEnteredAt;
      this.trackEvent('page_exit', this.currentPage, undefined, {
        fromPage: this.currentPage,
        toPage: page,
        timeOnPage,
      });
    }

    // Track entry to new page
    this.currentPage = page;
    this.pageEnteredAt = Date.now();
    this.trackEvent('page_view', page);
  }

  /**
   * Track a click event with zone detection
   */
  trackClick(
    event: MouseEvent | TouchEvent,
    zone?: InteractionZone,
    details?: SessionEventDetails
  ): void {
    const coords = this.getCoordinates(event);
    const detectedZone = zone || this.detectZone(event.target as HTMLElement);

    this.trackEvent('click', this.currentPage, detectedZone, details, coords);
  }

  /**
   * Track search action
   */
  trackSearch(query: string, resultCount?: number): void {
    this.trackEvent('search', this.currentPage, 'search-bar', {
      searchQuery: query,
      searchResultCount: resultCount,
    });
  }

  /**
   * Track sticker-related events
   */
  trackStickerEvent(
    action: 'browse' | 'select' | 'search' | 'upload_start' | 'upload_complete',
    details?: SessionEventDetails
  ): void {
    const eventType: SessionEventType = `sticker_${action}` as SessionEventType;
    const zone: InteractionZone = action === 'search' ? 'search-bar' : 'gallery';
    this.trackEvent(eventType, this.currentPage, zone, details);
  }

  /**
   * Track card-related events
   */
  trackCardEvent(
    action: 'browse' | 'select' | 'search' | 'customize',
    details?: SessionEventDetails
  ): void {
    const eventType: SessionEventType = `card_${action}` as SessionEventType;
    const zone: InteractionZone = action === 'search' ? 'search-bar' : 'gallery';
    this.trackEvent(eventType, this.currentPage, zone, details);
  }

  /**
   * Track gift card-related events
   */
  trackGiftCardEvent(
    action: 'browse' | 'select' | 'search' | 'purchase',
    details?: SessionEventDetails
  ): void {
    const eventType: SessionEventType = `giftcard_${action}` as SessionEventType;
    const zone: InteractionZone = action === 'search' ? 'search-bar' : 'gallery';
    this.trackEvent(eventType, this.currentPage, zone, details);
  }

  /**
   * Track editor events
   */
  trackEditorEvent(
    action: 'open' | 'tool_use' | 'save' | 'close',
    details?: SessionEventDetails
  ): void {
    const eventType: SessionEventType = `editor_${action}` as SessionEventType;
    const zone: InteractionZone = action === 'tool_use' ? 'editor-toolbar' : 'editor-canvas';
    this.trackEvent(eventType, this.currentPage, zone, details);
  }

  /**
   * Track checkout/payment events
   */
  trackCheckoutEvent(
    action: 'start' | 'payment_attempt' | 'payment_success' | 'payment_failure',
    details?: SessionEventDetails
  ): void {
    const eventTypeMap: Record<string, SessionEventType> = {
      start: 'checkout_start',
      payment_attempt: 'payment_attempt',
      payment_success: 'payment_success',
      payment_failure: 'payment_failure',
    };
    this.trackEvent(eventTypeMap[action], this.currentPage, 'checkout-form', details);
  }

  /**
   * Track print/send events
   */
  trackOutputEvent(
    action: 'print_start' | 'print_complete' | 'send_digital',
    details?: SessionEventDetails
  ): void {
    this.trackEvent(action, this.currentPage, 'main-content', details);
  }

  /**
   * Track tile selection from kiosk home
   */
  trackTileSelect(
    tileType: 'greeting_cards' | 'stickers' | 'gift_card',
    details?: SessionEventDetails
  ): void {
    this.trackEvent('tile_select', '/kiosk/home', 'main-content', {
      tileType,
      ...details,
    });
  }

  // ==================== Batch Processing ====================

  private startBatchTimer(): void {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.flushEvents();
    }, BATCH_INTERVAL_MS);
  }

  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.sessionId) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    let attempt = 0;
    while (attempt < RETRY_ATTEMPTS) {
      try {
        const response = await fetch('/api/kiosk/session/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            events: eventsToSend.map(e => ({
              eventType: e.eventType,
              page: e.page,
              zone: e.zone,
              details: e.details,
              coordinates: e.coordinates,
              timestamp: e.timestamp,
            })),
          }),
        });

        if (response.ok) {
          console.log(`[SessionService] Flushed ${eventsToSend.length} events`);
          return;
        }

        // If session is invalid (400), clear the persisted state and stop trying
        if (response.status === 400) {
          console.warn('[SessionService] Session invalid (400), clearing state');
          this.clearPersistedState();
          this.sessionId = null;
          this.state = 'idle';
          this.stopBatchTimer();
          return; // Don't retry, session is invalid
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        attempt++;
        if (attempt < RETRY_ATTEMPTS) {
          await this.delay(RETRY_DELAY_MS * attempt);
        } else {
          console.error('[SessionService] Failed to flush events after retries:', error);
          // Put events back in queue for next attempt
          this.eventQueue.unshift(...eventsToSend);
        }
      }
    }
  }

  // ==================== Utility Functions ====================

  private getCoordinates(event: MouseEvent | TouchEvent): EventCoordinates {
    let x: number, y: number;

    if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else if ('clientX' in event) {
      x = event.clientX;
      y = event.clientY;
    } else {
      x = 0;
      y = 0;
    }

    return {
      x,
      y,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }

  private detectZone(element: HTMLElement | null): InteractionZone {
    if (!element) return 'unknown';

    // Check data attributes first
    const zoneAttr = element.closest('[data-zone]')?.getAttribute('data-zone');
    if (zoneAttr) return zoneAttr as InteractionZone;

    // Check common element patterns
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';

    if (element.closest('header') || className.includes('header') || id.includes('header')) {
      return 'header';
    }
    if (element.closest('footer') || className.includes('footer') || id.includes('footer')) {
      return 'footer';
    }
    if (element.closest('nav') || className.includes('sidebar') || className.includes('nav')) {
      return 'navigation';
    }
    if (className.includes('search') || tagName === 'input' && element.getAttribute('type') === 'search') {
      return 'search-bar';
    }
    if (className.includes('gallery') || className.includes('grid')) {
      return 'gallery';
    }
    if (className.includes('editor') || className.includes('canvas')) {
      return 'editor-canvas';
    }
    if (className.includes('toolbar')) {
      return 'editor-toolbar';
    }
    if (className.includes('modal') || element.closest('[role="dialog"]')) {
      return 'modal';
    }
    if (className.includes('checkout') || className.includes('payment')) {
      return 'checkout-form';
    }

    return 'main-content';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Getters ====================

  get isActive(): boolean {
    return this.state === 'active';
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  get currentKioskId(): string | null {
    return this.kioskId;
  }

  // ==================== Online/Offline Handling ====================

  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    // Sync offline queue when coming back online
    if (online && wasOffline && this.offlineQueue.length > 0) {
      this.eventQueue.push(...this.offlineQueue);
      this.offlineQueue = [];
      this.flushEvents();
    }
  }
}

// ==================== Singleton Export ====================

export const kioskSessionService = new KioskSessionService();
