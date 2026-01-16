-- Migration: Create Session Recordings Table
-- Description: Stores screen recordings of kiosk user sessions for admin review

-- ==================== SESSION RECORDINGS TABLE ====================
CREATE TABLE IF NOT EXISTS session_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES kiosk_sessions(id) ON DELETE CASCADE,
    kiosk_id TEXT NOT NULL,
    
    -- Storage info
    storage_path TEXT, -- Path in Supabase storage bucket
    storage_url TEXT, -- Signed or public URL for playback
    thumbnail_path TEXT, -- Path to thumbnail image
    thumbnail_url TEXT, -- URL for thumbnail
    
    -- Recording metadata
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    format TEXT DEFAULT 'webm', -- webm, mp4
    resolution TEXT, -- e.g. '1920x1080'
    frame_rate INTEGER DEFAULT 1, -- frames per second
    
    -- Status tracking
    status TEXT CHECK (status IN (
        'recording',
        'processing', 
        'uploading',
        'completed',
        'failed'
    )) DEFAULT 'recording',
    error_message TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_kiosk_id ON session_recordings(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_status ON session_recordings(status);
CREATE INDEX IF NOT EXISTS idx_session_recordings_started_at ON session_recordings(started_at DESC);

-- ==================== UPDATED_AT TRIGGER ====================
CREATE OR REPLACE FUNCTION update_session_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_session_recordings_updated_at ON session_recordings;
CREATE TRIGGER trigger_session_recordings_updated_at
    BEFORE UPDATE ON session_recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_session_recordings_updated_at();

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read recordings
CREATE POLICY "Allow read access to session recordings" ON session_recordings
    FOR SELECT
    USING (true); -- Authorization handled in API layer

-- Allow insert for recording creation
CREATE POLICY "Allow insert session recordings" ON session_recordings
    FOR INSERT
    WITH CHECK (true);

-- Allow update for status changes
CREATE POLICY "Allow update session recordings" ON session_recordings
    FOR UPDATE
    USING (true);

-- Allow delete for cleanup
CREATE POLICY "Allow delete session recordings" ON session_recordings
    FOR DELETE
    USING (true);

-- ==================== ADD COLUMN TO KIOSK_SESSIONS (if needed) ====================
-- Add has_recording flag to sessions for quick filtering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kiosk_sessions' AND column_name = 'has_recording'
    ) THEN
        ALTER TABLE kiosk_sessions ADD COLUMN has_recording BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ==================== COMMENTS ====================
COMMENT ON TABLE session_recordings IS 'Stores screen recordings of kiosk user sessions for admin review and analytics';
COMMENT ON COLUMN session_recordings.storage_path IS 'Path to video file in session-recordings storage bucket';
COMMENT ON COLUMN session_recordings.frame_rate IS 'Recording frame rate in FPS (default 1 fps for efficiency)';
COMMENT ON COLUMN session_recordings.status IS 'Current status: recording, processing, uploading, completed, or failed';

-- ==================== STORAGE BUCKET (run in Supabase dashboard) ====================
-- Note: This needs to be run manually in the Supabase dashboard SQL editor
-- or via the Supabase CLI as it requires storage schema access:

/*
-- Create storage bucket for session recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-recordings', 
    'session-recordings', 
    false,  -- Private bucket, requires auth
    104857600,  -- 100MB max file size
    ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png'];

-- Storage policies for the bucket
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'session-recordings');

CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');
*/

