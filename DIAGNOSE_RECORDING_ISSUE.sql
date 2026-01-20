-- =============================================================================
-- DIAGNOSE RECORDING UPLOAD ISSUE
-- Run this in Supabase SQL Editor to check what's happening
-- =============================================================================

-- 1. Check if any recordings exist in the database
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_url,
  storage_path,
  webcam_storage_url,
  storage_url IS NOT NULL as has_video,
  webcam_storage_url IS NOT NULL as has_webcam,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) as duration_seconds
FROM session_recordings
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check recordings by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN storage_url IS NOT NULL THEN 1 END) as with_video,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors
FROM session_recordings
GROUP BY status
ORDER BY status;

-- 3. Check recent sessions with recordings
SELECT 
  ks.id as session_id,
  ks.started_at,
  ks.duration_seconds,
  ks.outcome,
  ks.has_recording,
  sr.id as recording_id,
  sr.status as recording_status,
  sr.storage_url IS NOT NULL as has_video_file,
  sr.error_message,
  sr.created_at as recording_created
FROM kiosk_sessions ks
LEFT JOIN session_recordings sr ON sr.session_id = ks.id
ORDER BY ks.started_at DESC
LIMIT 10;

-- 4. Check failed recordings (to see error messages)
SELECT 
  id,
  session_id,
  status,
  error_message,
  created_at,
  updated_at
FROM session_recordings
WHERE status = 'failed' OR error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if storage bucket has any files at all
-- Note: This needs to be checked in Supabase Dashboard → Storage
-- But we can check if paths exist in the database
SELECT 
  COUNT(*) as total_recordings,
  COUNT(storage_path) as with_storage_path,
  COUNT(storage_url) as with_storage_url,
  COUNT(webcam_storage_path) as with_webcam_path
FROM session_recordings;
