/**
 * Kiosk Session Tracking Service
 * 
 * Handles event collection, batching, and sending to the backend.
 * Designed for minimal performance impact with batched network calls.
 * Also integrates with screen recording for session playback.
 */

import type {
  SessionEventType,
  InteractionZone,
  SessionEventDetails,
  EventCoordinates,
  LogEventRequest,
  SessionOutcome,
} from '@/types/kioskSession';
import { sessionRecordingService } from './sessionRecordingService';

// ==================== Configuration ====================

const BATCH_INTERVAL_MS = 5000; // Send events every 5 seconds
const MAX_BATCH_SIZE = 50; // Maximum events per batch
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ==================== Types ====================

interface QueuedEvent {
  eventType: SessionEventType;
  page: string;
  zone?: InteractionZone;
  details?: SessionEventDetails;
  coordinates?: EventCoordinates;
  timestamp: string;
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
      
      // Start screen recording (non-blocking)
      this.startRecording();
      
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
   * Start screen recording for the session (non-blocking)
   */
  private async startRecording(): Promise<void> {
    if (!this.sessionId || !this.kioskId) return;

    try {
      await sessionRecordingService.startRecording(this.sessionId, this.kioskId);
      console.log('[SessionService] Screen recording started');
    } catch (error) {
      console.error('[SessionService] Failed to start recording (non-critical):', error);
      // Recording failure should not affect session tracking
    }
  }

  /**
   * Stop screen recording (non-blocking)
   */
  private async stopRecording(): Promise<void> {
    if (!sessionRecordingService.isRecording) return;

    try {
      await sessionRecordingService.stopRecording();
      console.log('[SessionService] Screen recording stopped');
    } catch (error) {
      console.error('[SessionService] Failed to stop recording (non-critical):', error);
    }
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

    // Stop screen recording (non-blocking, but wait for completion)
    await this.stopRecording();

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
    
    // Cancel recording on timeout (don't bother uploading abandoned sessions that timed out)
    if (sessionRecordingService.isRecording) {
      sessionRecordingService.cancelRecording();
    }
    
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
