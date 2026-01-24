-- Migration: Add Console Log Recording Columns
-- Description: Adds columns to store console log files alongside video recordings

ALTER TABLE session_recordings
ADD COLUMN IF NOT EXISTS console_log_storage_path TEXT,
ADD COLUMN IF NOT EXISTS console_log_storage_url TEXT;

-- Add comments
COMMENT ON COLUMN session_recordings.console_log_storage_path IS 'Path to console log JSON file in session-recordings storage bucket';
COMMENT ON COLUMN session_recordings.console_log_storage_url IS 'Signed or public URL for console log file download';
