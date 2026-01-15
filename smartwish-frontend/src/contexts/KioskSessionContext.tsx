'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useKiosk } from './KioskContext';
import { kioskSessionService } from '@/services/kioskSessionService';
import type {
  SessionEventType,
  InteractionZone,
  SessionEventDetails,
  SessionOutcome,
} from '@/types/kioskSession';

// ==================== Types ====================

interface KioskSessionContextType {
  // Session state
  isSessionActive: boolean;
  sessionId: string | null;

  // Session lifecycle
  startSession: () => Promise<string | null>;
  endSession: (outcome: SessionOutcome) => Promise<void>;
  handleTimeout: () => Promise<void>;

  // Event tracking
  trackEvent: (
    eventType: SessionEventType,
    zone?: InteractionZone,
    details?: SessionEventDetails
  ) => void;
  trackClick: (
    event: MouseEvent | TouchEvent,
    zone?: InteractionZone,
    details?: SessionEventDetails
  ) => void;
  trackSearch: (query: string, resultCount?: number) => void;
  trackTileSelect: (
    tileType: 'greeting_cards' | 'stickers' | 'gift_card',
    details?: SessionEventDetails
  ) => void;
  trackStickerEvent: (
    action: 'browse' | 'select' | 'search' | 'upload_start' | 'upload_complete',
    details?: SessionEventDetails
  ) => void;
  trackCardEvent: (
    action: 'browse' | 'select' | 'search' | 'customize',
    details?: SessionEventDetails
  ) => void;
  trackGiftCardEvent: (
    action: 'browse' | 'select' | 'search' | 'purchase',
    details?: SessionEventDetails
  ) => void;
  trackEditorEvent: (
    action: 'open' | 'tool_use' | 'save' | 'close',
    details?: SessionEventDetails
  ) => void;
  trackCheckoutEvent: (
    action: 'start' | 'payment_attempt' | 'payment_success' | 'payment_failure',
    details?: SessionEventDetails
  ) => void;
  trackOutputEvent: (
    action: 'print_start' | 'print_complete' | 'send_digital',
    details?: SessionEventDetails
  ) => void;
}

// ==================== Context ====================

const KioskSessionContext = createContext<KioskSessionContextType | undefined>(undefined);

export const useKioskSession = () => {
  const context = useContext(KioskSessionContext);
  if (!context) {
    throw new Error('useKioskSession must be used within KioskSessionProvider');
  }
  return context;
};

// Safe version that returns null outside provider
export const useKioskSessionSafe = () => {
  return useContext(KioskSessionContext) ?? null;
};

// ==================== Provider ====================

interface KioskSessionProviderProps {
  children: React.ReactNode;
}

export const KioskSessionProvider: React.FC<KioskSessionProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const { kioskId, isActivated } = useKiosk();
  const previousPathname = useRef<string>('');
  const sessionStartedRef = useRef(false);

  // Track if we're on kiosk home (session boundary)
  const isOnKioskHome = pathname === '/kiosk/home';

  // ==================== Session Lifecycle ====================

  const startSession = useCallback(async (): Promise<string | null> => {
    if (!kioskId) {
      console.warn('[KioskSessionContext] Cannot start session - no kioskId');
      return null;
    }

    if (sessionStartedRef.current && kioskSessionService.isActive) {
      console.log('[KioskSessionContext] Session already active');
      return kioskSessionService.currentSessionId;
    }

    sessionStartedRef.current = true;
    return await kioskSessionService.startSession(kioskId);
  }, [kioskId]);

  const endSession = useCallback(async (outcome: SessionOutcome): Promise<void> => {
    sessionStartedRef.current = false;
    await kioskSessionService.endSession(outcome);
  }, []);

  const handleTimeout = useCallback(async (): Promise<void> => {
    console.log('[KioskSessionContext] handleTimeout called, service state:', kioskSessionService.isActive);
    sessionStartedRef.current = false;
    await kioskSessionService.handleTimeout();
    console.log('[KioskSessionContext] handleTimeout completed');
  }, []);

  // ==================== Navigation Tracking ====================

  // Start session when leaving /kiosk/home
  useEffect(() => {
    if (!isActivated || !kioskId) return;

    const wasOnKioskHome = previousPathname.current === '/kiosk/home';
    const isLeavingKioskHome = wasOnKioskHome && !isOnKioskHome;
    const isReturningToKioskHome = !wasOnKioskHome && isOnKioskHome && previousPathname.current !== '';

    // Start session when user leaves /kiosk/home
    if (isLeavingKioskHome && !kioskSessionService.isActive) {
      console.log('[KioskSessionContext] User left kiosk home, starting session');
      startSession();
    }

    // End session when user returns to /kiosk/home (likely from timeout)
    if (isReturningToKioskHome && kioskSessionService.isActive) {
      console.log('[KioskSessionContext] User returned to kiosk home, ending session');
      endSession('abandoned');
    }

    // Track page view if session is active
    if (kioskSessionService.isActive && pathname !== previousPathname.current) {
      kioskSessionService.trackPageView(pathname);
    }

    previousPathname.current = pathname;
  }, [pathname, isActivated, kioskId, isOnKioskHome, startSession, endSession]);

  // ==================== Online/Offline Handling ====================

  useEffect(() => {
    const handleOnline = () => kioskSessionService.setOnlineStatus(true);
    const handleOffline = () => kioskSessionService.setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ==================== Cleanup on Unmount & Window Close ====================

  useEffect(() => {
    // Handle window close/unload
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // End session when window is closing
      if (kioskSessionService.isActive && kioskSessionService.currentSessionId) {
        const sessionId = kioskSessionService.currentSessionId;
        const outcome = 'abandoned';
        
        // Use fetch with keepalive for reliable delivery even if page is closing
        // This will continue even after the page unloads
        fetch('/api/kiosk/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, outcome }),
          keepalive: true, // Critical: keeps request alive after page closes
        }).catch(() => {
          // Ignore errors - request may not complete but browser will try
        });
        
        // Mark session as ended locally immediately
        kioskSessionService.state = 'idle';
        kioskSessionService.sessionId = null;
        kioskSessionService.kioskId = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // End session on unmount if still active (normal navigation)
      if (kioskSessionService.isActive) {
        endSession('abandoned');
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [endSession]);

  // ==================== Event Tracking Wrappers ====================

  const trackEvent = useCallback((
    eventType: SessionEventType,
    zone?: InteractionZone,
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackEvent(eventType, pathname, zone, details);
  }, [pathname]);

  const trackClick = useCallback((
    event: MouseEvent | TouchEvent,
    zone?: InteractionZone,
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackClick(event, zone, details);
  }, []);

  const trackSearch = useCallback((query: string, resultCount?: number) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackSearch(query, resultCount);
  }, []);

  const trackTileSelect = useCallback((
    tileType: 'greeting_cards' | 'stickers' | 'gift_card',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackTileSelect(tileType, details);
  }, []);

  const trackStickerEvent = useCallback((
    action: 'browse' | 'select' | 'search' | 'upload_start' | 'upload_complete',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackStickerEvent(action, details);
  }, []);

  const trackCardEvent = useCallback((
    action: 'browse' | 'select' | 'search' | 'customize',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackCardEvent(action, details);
  }, []);

  const trackGiftCardEvent = useCallback((
    action: 'browse' | 'select' | 'search' | 'purchase',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackGiftCardEvent(action, details);
  }, []);

  const trackEditorEvent = useCallback((
    action: 'open' | 'tool_use' | 'save' | 'close',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackEditorEvent(action, details);
  }, []);

  const trackCheckoutEvent = useCallback((
    action: 'start' | 'payment_attempt' | 'payment_success' | 'payment_failure',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackCheckoutEvent(action, details);
  }, []);

  const trackOutputEvent = useCallback((
    action: 'print_start' | 'print_complete' | 'send_digital',
    details?: SessionEventDetails
  ) => {
    if (!kioskSessionService.isActive) return;
    kioskSessionService.trackOutputEvent(action, details);
  }, []);

  // ==================== Context Value ====================

  const value: KioskSessionContextType = {
    isSessionActive: kioskSessionService.isActive,
    sessionId: kioskSessionService.currentSessionId,
    startSession,
    endSession,
    handleTimeout,
    trackEvent,
    trackClick,
    trackSearch,
    trackTileSelect,
    trackStickerEvent,
    trackCardEvent,
    trackGiftCardEvent,
    trackEditorEvent,
    trackCheckoutEvent,
    trackOutputEvent,
  };

  return (
    <KioskSessionContext.Provider value={value}>
      {children}
    </KioskSessionContext.Provider>
  );
};
