-- Migration: Add Webcam Recording Columns
-- Description: Adds columns to store webcam video recordings alongside screen recordings

-- ==================== ADD WEBCAM COLUMNS ====================
ALTER TABLE session_recordings 
ADD COLUMN IF NOT EXISTS webcam_storage_path TEXT,
ADD COLUMN IF NOT EXISTS webcam_storage_url TEXT,
ADD COLUMN IF NOT EXISTS webcam_file_size_bytes BIGINT;

-- ==================== COMMENTS ====================
COMMENT ON COLUMN session_recordings.webcam_storage_path IS 'Path to webcam video file in session-recordings storage bucket';
COMMENT ON COLUMN session_recordings.webcam_storage_url IS 'Signed or public URL for webcam video playback';
COMMENT ON COLUMN session_recordings.webcam_file_size_bytes IS 'Size of webcam video file in bytes';
