-- =====================================================
-- Add session_id to kiosk_chat_messages
-- This allows isolating chat sessions per user on kiosks
-- =====================================================

-- Add session_id column (nullable for backward compatibility with existing messages)
ALTER TABLE kiosk_chat_messages 
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Create index for session-based queries
CREATE INDEX IF NOT EXISTS idx_kiosk_chat_messages_session_id 
ON kiosk_chat_messages(kiosk_id, session_id, created_at DESC);

-- Update unread counts view to include session info
DROP VIEW IF EXISTS kiosk_chat_unread_counts CASCADE;

CREATE OR REPLACE VIEW kiosk_chat_unread_counts AS
SELECT 
    kiosk_id,
    session_id,
    COUNT(*) as unread_count,
    MAX(created_at) as last_message_at
FROM kiosk_chat_messages
WHERE is_read = false AND sender_type = 'admin'
GROUP BY kiosk_id, session_id;

GRANT SELECT ON kiosk_chat_unread_counts TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
