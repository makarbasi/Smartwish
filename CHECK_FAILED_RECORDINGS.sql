-- =============================================================================
-- CHECK WHY RECORDINGS ARE FAILING
-- Run this to see what's wrong with the 25 failed recordings
-- =============================================================================

-- 1. Check status breakdown
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN storage_url IS NOT NULL THEN 1 END) as with_url,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors
FROM session_recordings
GROUP BY status
ORDER BY status;

-- 2. Check recent failed recordings with error messages
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_path,
  storage_url,
  created_at,
  updated_at,
  CASE 
    WHEN status = 'failed' THEN '❌ FAILED'
    WHEN status = 'recording' THEN '⏸️ STILL RECORDING'
    WHEN status = 'processing' THEN '⏳ PROCESSING'
    WHEN status = 'uploading' THEN '⬆️ UPLOADING'
    WHEN status = 'completed' AND storage_url IS NULL THEN '⚠️ COMPLETED BUT NO FILE'
    WHEN status = 'completed' AND storage_url IS NOT NULL THEN '✅ SUCCESS'
    ELSE status
  END as status_label
FROM session_recordings
WHERE storage_url IS NULL  -- Only show ones without files
ORDER BY created_at DESC
LIMIT 15;

-- 3. Check the 2 successful recordings (for comparison)
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_path,
  storage_url,
  file_size_bytes,
  created_at,
  updated_at
FROM session_recordings
WHERE storage_url IS NOT NULL
ORDER BY created_at DESC;

-- 4. Check if there's a pattern - maybe older recordings work but newer don't?
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  COUNT(CASE WHEN storage_url IS NOT NULL THEN 1 END) as successful,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors
FROM session_recordings
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC
LIMIT 24;

-- 5. Get most recent recording attempt details
SELECT 
  id,
  session_id,
  status,
  error_message,
  storage_path,
  storage_url,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) as duration_seconds
FROM session_recordings
ORDER BY created_at DESC
LIMIT 5;
