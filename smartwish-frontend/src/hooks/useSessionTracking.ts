'use client';

import { useCallback } from 'react';
import { useKioskSessionSafe } from '@/contexts/KioskSessionContext';
import type { SessionEventDetails, InteractionZone } from '@/types/kioskSession';

/**
 * Convenient hook for tracking session events in components.
 * Returns no-op functions when not in a kiosk session.
 * 
 * @example
 * ```tsx
 * const { trackSearch, trackCardSelect, trackClick } = useSessionTracking();
 * 
 * // In your search handler:
 * const handleSearch = (query: string) => {
 *   trackSearch(query, results.length);
 *   // ... rest of search logic
 * };
 * 
 * // In your card selection:
 * const handleSelectCard = (card: Card) => {
 *   trackCardSelect({ itemId: card.id, itemTitle: card.title });
 *   // ... rest of selection logic
 * };
 * ```
 */
export function useSessionTracking() {
  const session = useKioskSessionSafe();

  // No-op functions when session is not available
  const noop = useCallback(() => {}, []);
  const noopWithParams = useCallback((_?: unknown, __?: unknown) => {}, []);

  if (!session) {
    return {
      isTracking: false,
      trackClick: noopWithParams as (event: MouseEvent | TouchEvent, zone?: InteractionZone, details?: SessionEventDetails) => void,
      trackSearch: noopWithParams as (query: string, resultCount?: number) => void,
      
      // Tile selection tracking
      trackTileSelect: noopWithParams as (tileType: 'greeting_cards' | 'stickers' | 'gift_card', details?: SessionEventDetails) => void,
      
      // Sticker tracking
      trackStickerBrowse: noop,
      trackStickerSelect: noopWithParams as (details?: SessionEventDetails) => void,
      trackStickerSearch: noopWithParams as (query: string, resultCount?: number) => void,
      trackStickerUploadStart: noop,
      trackStickerUploadComplete: noop,
      
      // Card tracking
      trackCardBrowse: noop,
      trackCardSelect: noopWithParams as (details?: SessionEventDetails) => void,
      trackCardSearch: noopWithParams as (query: string, resultCount?: number) => void,
      trackCardCustomize: noopWithParams as (details?: SessionEventDetails) => void,
      
      // Gift card tracking
      trackGiftCardBrowse: noop,
      trackGiftCardSelect: noopWithParams as (details?: SessionEventDetails) => void,
      trackGiftCardSearch: noopWithParams as (query: string, resultCount?: number) => void,
      trackGiftCardPurchase: noopWithParams as (details?: SessionEventDetails) => void,
      
      // Editor tracking
      trackEditorOpen: noop,
      trackEditorToolUse: noopWithParams as (toolName: string) => void,
      trackEditorSave: noopWithParams as (durationMs?: number) => void,
      trackEditorClose: noop,
      
      // Checkout tracking
      trackCheckoutStart: noop,
      trackPaymentAttempt: noopWithParams as (details?: SessionEventDetails) => void,
      trackPaymentSuccess: noopWithParams as (details?: SessionEventDetails) => void,
      trackPaymentFailure: noopWithParams as (errorMessage: string) => void,
      
      // Output tracking
      trackPrintStart: noopWithParams as (printType: 'card' | 'sticker') => void,
      trackPrintComplete: noopWithParams as (printType: 'card' | 'sticker') => void,
      trackSendDigital: noop,

      // Session outcome
      endWithPrintedCard: noop,
      endWithPrintedSticker: noop,
      endWithSentDigital: noop,
    };
  }

  return {
    isTracking: session.isSessionActive,
    
    // Click tracking
    trackClick: session.trackClick,
    
    // Search tracking
    trackSearch: session.trackSearch,
    
    // Tile selection tracking
    trackTileSelect: (tileType: 'greeting_cards' | 'stickers' | 'gift_card', details?: SessionEventDetails) =>
      session.trackTileSelect(tileType, details),
    
    // Sticker tracking
    trackStickerBrowse: () => session.trackStickerEvent('browse'),
    trackStickerSelect: (details?: SessionEventDetails) => 
      session.trackStickerEvent('select', details),
    trackStickerSearch: (query: string, resultCount?: number) => 
      session.trackStickerEvent('search', { searchQuery: query, searchResultCount: resultCount }),
    trackStickerUploadStart: () => session.trackStickerEvent('upload_start'),
    trackStickerUploadComplete: () => session.trackStickerEvent('upload_complete'),
    
    // Card tracking
    trackCardBrowse: () => session.trackCardEvent('browse'),
    trackCardSelect: (details?: SessionEventDetails) => 
      session.trackCardEvent('select', details),
    trackCardSearch: (query: string, resultCount?: number) => 
      session.trackCardEvent('search', { searchQuery: query, searchResultCount: resultCount }),
    trackCardCustomize: (details?: SessionEventDetails) => 
      session.trackCardEvent('customize', details),
    
    // Gift card tracking
    trackGiftCardBrowse: () => session.trackGiftCardEvent('browse'),
    trackGiftCardSelect: (details?: SessionEventDetails) => 
      session.trackGiftCardEvent('select', details),
    trackGiftCardSearch: (query: string, resultCount?: number) => 
      session.trackGiftCardEvent('search', { searchQuery: query, searchResultCount: resultCount }),
    trackGiftCardPurchase: (details?: SessionEventDetails) => 
      session.trackGiftCardEvent('purchase', details),
    
    // Editor tracking
    trackEditorOpen: () => session.trackEditorEvent('open'),
    trackEditorToolUse: (toolName: string) => 
      session.trackEditorEvent('tool_use', { editorTool: toolName }),
    trackEditorSave: (durationMs?: number) => 
      session.trackEditorEvent('save', { editDurationMs: durationMs }),
    trackEditorClose: () => session.trackEditorEvent('close'),
    
    // Checkout tracking
    trackCheckoutStart: () => session.trackCheckoutEvent('start'),
    trackPaymentAttempt: (details?: SessionEventDetails) => 
      session.trackCheckoutEvent('payment_attempt', details),
    trackPaymentSuccess: (details?: SessionEventDetails) => 
      session.trackCheckoutEvent('payment_success', details),
    trackPaymentFailure: (errorMessage: string) => 
      session.trackCheckoutEvent('payment_failure', { errorMessage }),
    
    // Output tracking
    trackPrintStart: (printType: 'card' | 'sticker') => 
      session.trackOutputEvent('print_start', { printType }),
    trackPrintComplete: (printType: 'card' | 'sticker') => 
      session.trackOutputEvent('print_complete', { printType }),
    trackSendDigital: () => session.trackOutputEvent('send_digital'),

    // Session outcome helpers
    endWithPrintedCard: () => session.endSession('printed_card'),
    endWithPrintedSticker: () => session.endSession('printed_sticker'),
    endWithSentDigital: () => session.endSession('sent_digital'),
  };
}
