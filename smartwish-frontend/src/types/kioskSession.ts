/**
 * Kiosk Session Analytics Types
 * 
 * Types for tracking user sessions and events on kiosk devices.
 */

// ==================== Session Types ====================

export type SessionOutcome = 
  | 'printed_card'
  | 'printed_sticker'
  | 'sent_digital'
  | 'abandoned'
  | 'in_progress';

export interface KioskSession {
  id: string;
  kioskId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: SessionOutcome;
  totalEvents: number;
  pagesVisited: string[];
  totalClicks: number;
  
  // Feature usage flags
  browsedGreetingCards: boolean;
  browsedStickers: boolean;
  browsedGiftCards: boolean;
  usedSearch: boolean;
  uploadedImage: boolean;
  usedPinturaEditor: boolean;
  reachedCheckout: boolean;
  completedPayment: boolean;
  
  // Recording
  hasRecording: boolean;
  
  createdAt: string;
  updatedAt: string;
}

// ==================== Event Types ====================

export type SessionEventType =
  // Navigation events
  | 'page_view'
  | 'page_exit'
  | 'tile_select' // Which tile user selected from kiosk home
  
  // Interaction events
  | 'click'
  | 'scroll'
  | 'search'
  
  // Sticker events
  | 'sticker_browse'
  | 'sticker_select'
  | 'sticker_search'
  | 'sticker_upload_start'
  | 'sticker_upload_complete'
  
  // Card events
  | 'card_browse'
  | 'card_select'
  | 'card_search'
  | 'card_customize'
  
  // Editor events
  | 'editor_open'
  | 'editor_tool_use'
  | 'editor_save'
  | 'editor_close'
  
  // Checkout events
  | 'checkout_start'
  | 'payment_attempt'
  | 'payment_success'
  | 'payment_failure'
  
  // Gift card events
  | 'giftcard_browse'
  | 'giftcard_select'
  | 'giftcard_search'
  | 'giftcard_purchase'
  
  // Output events
  | 'print_start'
  | 'print_complete'
  | 'send_digital'
  
  // Session lifecycle
  | 'session_start'
  | 'session_timeout'
  | 'session_end';

export type InteractionZone =
  | 'header'
  | 'sidebar'
  | 'main-content'
  | 'footer'
  | 'search-bar'
  | 'gallery'
  | 'card-preview'
  | 'editor-canvas'
  | 'editor-toolbar'
  | 'checkout-form'
  | 'navigation'
  | 'modal'
  | 'unknown';

export interface EventCoordinates {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface SessionEventDetails {
  // Search-related
  searchQuery?: string;
  searchResultCount?: number;
  
  // Selection-related
  itemId?: string;
  itemTitle?: string;
  itemCategory?: string;
  
  // Editor-related
  editorTool?: string;
  editDurationMs?: number;
  
  // Payment-related
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  errorMessage?: string;
  
  // Print-related
  printJobId?: string;
  printType?: 'card' | 'sticker';
  
  // Navigation-related
  fromPage?: string;
  toPage?: string;
  timeOnPage?: number; // milliseconds
  
  // Generic
  buttonId?: string;
  buttonText?: string;
  componentName?: string;
  
  // Allow additional properties
  [key: string]: unknown;
}

export interface KioskSessionEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  eventType: SessionEventType;
  page: string;
  zone: InteractionZone | null;
  details: SessionEventDetails;
  coordinates: EventCoordinates | null;
  createdAt: string;
}

// ==================== API Request/Response Types ====================

export interface CreateSessionRequest {
  kioskId: string;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface LogEventRequest {
  sessionId: string;
  eventType: SessionEventType;
  page: string;
  zone?: InteractionZone;
  details?: SessionEventDetails;
  coordinates?: EventCoordinates;
  timestamp?: string; // ISO string, defaults to server time
}

export interface LogEventBatchRequest {
  sessionId: string;
  events: Array<Omit<LogEventRequest, 'sessionId'>>;
}

export interface EndSessionRequest {
  sessionId: string;
  outcome: SessionOutcome;
}

export interface SessionSummary {
  totalSessions: number;
  totalEvents: number;
  averageDuration: number;
  outcomeBreakdown: Record<SessionOutcome, number>;
  featureUsage: {
    greetingCards: number;
    stickers: number;
    search: number;
    imageUpload: number;
    editor: number;
    checkout: number;
    payment: number;
  };
  conversionRate: number; // Percentage of sessions that resulted in print/send
}

export interface SessionListFilters {
  outcome?: SessionOutcome | 'all';
  startDate?: string;
  endDate?: string;
  minDuration?: number;
  maxDuration?: number;
  hasSearch?: boolean;
  hasUpload?: boolean;
  hasEditor?: boolean;
}

export interface SessionListResponse {
  sessions: KioskSession[];
  total: number;
  page: number;
  pageSize: number;
  summary: SessionSummary;
}

export interface SessionDetailResponse {
  session: KioskSession;
  events: KioskSessionEvent[];
  behaviorSummary: string; // AI-generated or template-based summary
  journey: SessionJourneyStep[];
}

export interface SessionJourneyStep {
  page: string;
  enteredAt: string;
  exitedAt: string | null;
  durationMs: number;
  eventCount: number;
  highlights: string[]; // Key actions on this page
}

// ==================== Database Row Types (snake_case) ====================

export interface KioskSessionRow {
  id: string;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: SessionOutcome;
  total_events: number;
  pages_visited: string[];
  total_clicks: number;
  browsed_greeting_cards: boolean;
  browsed_stickers: boolean;
  browsed_gift_cards: boolean;
  used_search: boolean;
  uploaded_image: boolean;
  used_pintura_editor: boolean;
  reached_checkout: boolean;
  completed_payment: boolean;
  has_recording: boolean;
  created_at: string;
  updated_at: string;
}

export interface KioskSessionEventRow {
  id: string;
  session_id: string;
  timestamp: string;
  event_type: SessionEventType;
  page: string;
  zone: InteractionZone | null;
  details: SessionEventDetails;
  coordinates: EventCoordinates | null;
  created_at: string;
}

// ==================== Transformer Functions ====================

export function sessionRowToSession(row: KioskSessionRow): KioskSession {
  return {
    id: row.id,
    kioskId: row.kiosk_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    outcome: row.outcome,
    totalEvents: row.total_events,
    pagesVisited: row.pages_visited,
    totalClicks: row.total_clicks,
    browsedGreetingCards: row.browsed_greeting_cards,
    browsedStickers: row.browsed_stickers,
    browsedGiftCards: row.browsed_gift_cards,
    usedSearch: row.used_search,
    uploadedImage: row.uploaded_image,
    usedPinturaEditor: row.used_pintura_editor,
    reachedCheckout: row.reached_checkout,
    completedPayment: row.completed_payment,
    hasRecording: row.has_recording,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eventRowToEvent(row: KioskSessionEventRow): KioskSessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    eventType: row.event_type,
    page: row.page,
    zone: row.zone,
    details: row.details,
    coordinates: row.coordinates,
    createdAt: row.created_at,
  };
}
