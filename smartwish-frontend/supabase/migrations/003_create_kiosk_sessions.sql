-- Migration: Create Kiosk Session Analytics Tables
-- Description: Tables to track user working sessions and events on kiosk devices

-- ==================== KIOSK SESSIONS TABLE ====================
-- Stores high-level session information
CREATE TABLE IF NOT EXISTS kiosk_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id TEXT NOT NULL REFERENCES kiosk_configs(kiosk_id) ON DELETE CASCADE,
    
    -- Session timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER, -- Computed on session end
    
    -- Session outcome
    outcome TEXT CHECK (outcome IN (
        'printed_card',
        'printed_sticker', 
        'sent_digital',
        'abandoned',
        'in_progress'
    )) DEFAULT 'in_progress',
    
    -- Summary stats (populated on session end)
    total_events INTEGER DEFAULT 0,
    pages_visited TEXT[] DEFAULT '{}',
    total_clicks INTEGER DEFAULT 0,
    
    -- Feature usage flags (for quick filtering)
    browsed_greeting_cards BOOLEAN DEFAULT FALSE,
    browsed_stickers BOOLEAN DEFAULT FALSE,
    browsed_gift_cards BOOLEAN DEFAULT FALSE,
    used_search BOOLEAN DEFAULT FALSE,
    uploaded_image BOOLEAN DEFAULT FALSE,
    used_pintura_editor BOOLEAN DEFAULT FALSE,
    reached_checkout BOOLEAN DEFAULT FALSE,
    completed_payment BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== KIOSK SESSION EVENTS TABLE ====================
-- Stores individual events within a session
CREATE TABLE IF NOT EXISTS kiosk_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES kiosk_sessions(id) ON DELETE CASCADE,
    
    -- Event timing
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Event type categorization
    event_type TEXT NOT NULL CHECK (event_type IN (
        -- Navigation events
        'page_view',
        'page_exit',
        
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
    )),
    
    -- Context
    page TEXT NOT NULL, -- Current page path
    
    -- Click/interaction zone (for heatmap analysis)
    zone TEXT, -- e.g., 'header', 'sidebar', 'main-content', 'footer', 'search-bar', 'gallery', etc.
    
    -- Additional event details (flexible JSON)
    details JSONB DEFAULT '{}',
    
    -- Coordinates (optional, for detailed click tracking)
    coordinates JSONB, -- { x: number, y: number, viewport_width: number, viewport_height: number }
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_kiosk_id ON kiosk_sessions(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_started_at ON kiosk_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_outcome ON kiosk_sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_kiosk_outcome ON kiosk_sessions(kiosk_id, outcome);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_kiosk_session_events_session_id ON kiosk_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_session_events_timestamp ON kiosk_session_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_kiosk_session_events_type ON kiosk_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kiosk_session_events_session_type ON kiosk_session_events(session_id, event_type);

-- ==================== UPDATED_AT TRIGGER ====================

-- Create function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_kiosk_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_kiosk_sessions_updated_at ON kiosk_sessions;
CREATE TRIGGER trigger_kiosk_sessions_updated_at
    BEFORE UPDATE ON kiosk_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_kiosk_sessions_updated_at();

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS
ALTER TABLE kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_session_events ENABLE ROW LEVEL SECURITY;

-- Sessions policies
-- Allow authenticated users to read sessions for kiosks they have access to
CREATE POLICY "Allow read access to kiosk sessions" ON kiosk_sessions
    FOR SELECT
    USING (true); -- We'll handle authorization in the API layer

-- Allow insert for new sessions
CREATE POLICY "Allow insert kiosk sessions" ON kiosk_sessions
    FOR INSERT
    WITH CHECK (true);

-- Allow update for session management
CREATE POLICY "Allow update kiosk sessions" ON kiosk_sessions
    FOR UPDATE
    USING (true);

-- Allow delete for admins (handled in API)
CREATE POLICY "Allow delete kiosk sessions" ON kiosk_sessions
    FOR DELETE
    USING (true);

-- Events policies
CREATE POLICY "Allow read access to session events" ON kiosk_session_events
    FOR SELECT
    USING (true);

CREATE POLICY "Allow insert session events" ON kiosk_session_events
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow delete session events" ON kiosk_session_events
    FOR DELETE
    USING (true);

-- ==================== COMMENTS ====================

COMMENT ON TABLE kiosk_sessions IS 'Tracks user working sessions on kiosk devices from arrival to departure';
COMMENT ON TABLE kiosk_session_events IS 'Stores individual user interaction events within a kiosk session';

COMMENT ON COLUMN kiosk_sessions.outcome IS 'Final outcome of the session: printed_card, printed_sticker, sent_digital, abandoned, or in_progress';
COMMENT ON COLUMN kiosk_sessions.pages_visited IS 'Array of unique page paths visited during the session';
COMMENT ON COLUMN kiosk_session_events.zone IS 'UI zone where interaction occurred for heatmap analysis';
COMMENT ON COLUMN kiosk_session_events.details IS 'Flexible JSON for event-specific data like search terms, selected items, etc.';

-- ==================== UPGRADE FOR EXISTING DATABASES ====================
-- Run these statements if you already have the tables created:

-- Add browsed_gift_cards column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kiosk_sessions' AND column_name = 'browsed_gift_cards'
    ) THEN
        ALTER TABLE kiosk_sessions ADD COLUMN browsed_gift_cards BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update event_type constraint to include gift card events (only if needed)
-- Note: This drops and recreates the constraint, which requires all existing values to be valid
-- ALTER TABLE kiosk_session_events DROP CONSTRAINT IF EXISTS kiosk_session_events_event_type_check;
-- (Constraint recreation is automatic with the new CHECK definition above)
