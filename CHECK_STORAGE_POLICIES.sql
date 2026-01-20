-- =============================================================================
-- CHECK STORAGE BUCKET POLICIES
-- Run these queries in Supabase SQL Editor to verify RLS policies
-- =============================================================================

-- 1. Check if bucket exists
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE name = 'session-recordings';

-- 2. Check existing RLS policies on storage.objects for session-recordings bucket
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%session%recording%' 
   OR policyname LIKE '%session-recordings%'
ORDER BY policyname;

-- 3. Check ALL policies on storage.objects (to see what exists)
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
ORDER BY policyname;

-- 4. Check if RLS is enabled on storage.objects
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

-- =============================================================================
-- CREATE/UPDATE POLICIES (Run these if policies don't exist or are incorrect)
-- =============================================================================

-- Drop existing policies if they exist (to recreate them correctly)
DROP POLICY IF EXISTS "Authenticated users can view session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete session recordings" ON storage.objects;

-- Policy 1: Allow authenticated users to SELECT (view) recordings
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

-- Policy 2: Allow service_role to INSERT (upload) recordings
-- NOTE: This is critical for backend uploads! Must use service_role, NOT authenticated!
CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'session-recordings');

-- Policy 3: Allow authenticated users to UPDATE recordings (if needed)
CREATE POLICY "Authenticated users can update session recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'session-recordings')
WITH CHECK (bucket_id = 'session-recordings');

-- Policy 4: Allow authenticated users to DELETE recordings
CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');

-- Alternative: Allow service_role to do everything (more permissive, useful for backend)
-- This allows the backend to manage all files in the bucket
CREATE POLICY "Service role can manage session recordings"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'session-recordings')
WITH CHECK (bucket_id = 'session-recordings');

-- =============================================================================
-- VERIFY POLICIES AFTER CREATION
-- =============================================================================

-- Run this again to see newly created policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  substring(qual, 1, 100) as qual_preview,
  substring(with_check, 1, 100) as with_check_preview
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
    policyname LIKE '%session%recording%' 
    OR policyname LIKE '%session-recordings%'
    OR roles = ARRAY['service_role']
  )
ORDER BY policyname;

-- =============================================================================
-- TEST PERMISSIONS (Optional - verify service role can upload)
-- =============================================================================

-- Note: You can't easily test service_role permissions from SQL Editor
-- as it runs as the authenticated user. But if backend uploads work,
-- that confirms service_role permissions are correct.

-- Check what role you're currently using
SELECT current_user, session_user;
