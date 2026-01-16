-- Migration: Add tile_select event type to kiosk_session_events
-- Description: Adds the tile_select event type for tracking which tile user selects from kiosk home

-- Drop the existing constraint and add a new one with tile_select
ALTER TABLE kiosk_session_events DROP CONSTRAINT IF EXISTS kiosk_session_events_event_type_check;

ALTER TABLE kiosk_session_events ADD CONSTRAINT kiosk_session_events_event_type_check 
CHECK (event_type IN (
    -- Navigation events
    'page_view',
    'page_exit',
    'tile_select', -- NEW: Which tile user selected from kiosk home
    
    -- Interaction events
    'click',
    'scroll',
    'search',
    
    -- Feature-specific events
    'sticker_browse',
    'sticker_select',
    'sticker_search',
    'sticker_upload_start',
    'sticker_upload_complete',
    
    'card_browse',
    'card_select',
    'card_search',
    'card_customize',
    
    'giftcard_browse',
    'giftcard_select',
    'giftcard_search',
    'giftcard_purchase',
    
    'editor_open',
    'editor_tool_use',
    'editor_save',
    'editor_close',
    
    'checkout_start',
    'payment_attempt',
    'payment_success',
    'payment_failure',
    
    'print_start',
    'print_complete',
    'send_digital',
    
    -- Session events
    'session_start',
    'session_timeout',
    'session_end'
));

COMMENT ON CONSTRAINT kiosk_session_events_event_type_check ON kiosk_session_events IS 'Allowed event types for session tracking - includes tile_select for tracking tile selection from kiosk home';

