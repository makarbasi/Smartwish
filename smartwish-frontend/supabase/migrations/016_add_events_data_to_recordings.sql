-- Migration: Add events_data column to session_recordings
-- Description: Store session events directly in database instead of storage bucket
-- (Supabase storage bucket only allows video/image MIME types)

-- Add JSONB column for storing recorded events
ALTER TABLE session_recordings 
ADD COLUMN IF NOT EXISTS events_data JSONB DEFAULT '[]'::jsonb;

-- Add index for potential querying of events
CREATE INDEX IF NOT EXISTS idx_session_recordings_events_data 
ON session_recordings USING GIN (events_data);

COMMENT ON COLUMN session_recordings.events_data IS 'Stored session events (mouse moves, clicks, DOM snapshots) as JSONB array';
