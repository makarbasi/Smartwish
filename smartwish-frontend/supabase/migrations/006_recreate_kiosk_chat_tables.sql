-- =====================================================
-- Kiosk Chat System - Complete Recreation
-- This migration drops and recreates all chat-related objects
-- =====================================================

-- Step 1: Remove from Supabase Realtime publication (if exists)
DO $$
BEGIN
    -- Check if table exists in publication before trying to remove it
    IF EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'kiosk_chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE kiosk_chat_messages;
        RAISE NOTICE 'Removed kiosk_chat_messages from Realtime publication';
    ELSE
        RAISE NOTICE 'kiosk_chat_messages not in Realtime publication, skipping removal';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not remove from Realtime publication: %', SQLERRM;
END $$;

-- Step 2: Drop the view (if exists)
DROP VIEW IF EXISTS kiosk_chat_unread_counts CASCADE;

-- Step 3: Drop all RLS policies (if they exist)
DROP POLICY IF EXISTS "Kiosks can view their own messages" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Kiosks can insert their own messages" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Admins can update read status" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Service role can perform all operations" ON kiosk_chat_messages;
DROP POLICY IF EXISTS "Allow all operations for API routes" ON kiosk_chat_messages;

-- Step 4: Drop the trigger (if exists)
DROP TRIGGER IF EXISTS trg_kiosk_chat_messages_updated_at ON kiosk_chat_messages;

-- Step 5: Drop the function (if exists)
DROP FUNCTION IF EXISTS update_kiosk_chat_messages_updated_at() CASCADE;

-- Step 6: Drop indexes (if they exist)
DROP INDEX IF EXISTS idx_kiosk_chat_messages_kiosk_id;
DROP INDEX IF EXISTS idx_kiosk_chat_messages_unread;
DROP INDEX IF EXISTS idx_kiosk_chat_messages_sender_type;

-- Step 7: Drop the table (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS kiosk_chat_messages CASCADE;

-- Step 8: Revoke permissions (if they exist)
-- Note: These will fail silently if permissions don't exist
DO $$
BEGIN
    REVOKE SELECT, INSERT, UPDATE ON kiosk_chat_messages FROM authenticated;
    REVOKE SELECT, INSERT, UPDATE ON kiosk_chat_messages FROM anon;
EXCEPTION
    WHEN OTHERS THEN
        -- Permissions may not exist, ignore
        NULL;
END $$;

-- =====================================================
-- Step 9: Recreate everything from scratch
-- =====================================================

-- Create the main chat messages table
CREATE TABLE kiosk_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id VARCHAR(128) NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('kiosk', 'admin')),
    sender_id UUID, -- NULL for kiosk, user_id for admin
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_kiosk_chat_messages_kiosk_id ON kiosk_chat_messages(kiosk_id, created_at DESC);
CREATE INDEX idx_kiosk_chat_messages_unread ON kiosk_chat_messages(kiosk_id, is_read) WHERE is_read = false;
CREATE INDEX idx_kiosk_chat_messages_sender_type ON kiosk_chat_messages(sender_type, created_at DESC);

-- Add foreign key constraint to kiosk_configs if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kiosk_configs') THEN
        ALTER TABLE kiosk_chat_messages
        ADD CONSTRAINT fk_kiosk_chat_messages_kiosk_id 
        FOREIGN KEY (kiosk_id) REFERENCES kiosk_configs(kiosk_id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to kiosk_configs';
    ELSE
        RAISE NOTICE 'kiosk_configs table does not exist, skipping foreign key constraint';
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kiosk_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trg_kiosk_chat_messages_updated_at
BEFORE UPDATE ON kiosk_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_kiosk_chat_messages_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE kiosk_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy
-- Allow all operations - security is handled at the API route level
-- This allows server-side API routes to work while still having RLS enabled
CREATE POLICY "Allow all operations for API routes"
ON kiosk_chat_messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable Supabase Realtime for this table
DO $$
BEGIN
    -- Try to add table to Realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE kiosk_chat_messages;
        RAISE NOTICE 'Successfully enabled Realtime for kiosk_chat_messages';
    EXCEPTION
        -- Table is already in the publication (SQLSTATE 42710) - this is fine
        WHEN SQLSTATE '42710' THEN
            RAISE NOTICE 'Realtime is already enabled for kiosk_chat_messages';
        -- Other errors (permissions, etc.)
        WHEN OTHERS THEN
            RAISE WARNING 'Could not enable Realtime automatically. Please enable manually in Supabase Dashboard: Database > Replication > Enable for kiosk_chat_messages. Error: %', SQLERRM;
    END;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON kiosk_chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON kiosk_chat_messages TO anon;

-- Create view for unread message counts per kiosk
CREATE OR REPLACE VIEW kiosk_chat_unread_counts AS
SELECT 
    kiosk_id,
    COUNT(*) as unread_count,
    MAX(created_at) as last_message_at
FROM kiosk_chat_messages
WHERE is_read = false AND sender_type = 'admin'
GROUP BY kiosk_id;

GRANT SELECT ON kiosk_chat_unread_counts TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
-- All chat-related objects have been dropped and recreated
-- The table is ready for use with backend-only Supabase communication
-- =====================================================
