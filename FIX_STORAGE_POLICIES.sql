-- =============================================================================
-- FIX STORAGE POLICIES - Safe Script (Drops then Recreates)
-- Run this in Supabase SQL Editor to fix storage policies
-- =============================================================================

-- Step 1: Check current policies (optional - for reference)
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
    policyname LIKE '%session%recording%' 
    OR policyname LIKE '%session-recordings%'
  )
ORDER BY cmd;

-- Step 2: Drop existing policies (safe - uses IF EXISTS)
DROP POLICY IF EXISTS "Authenticated users can view session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete session recordings" ON storage.objects;

-- Step 3: Create policies with correct roles
-- Policy 1: SELECT - Authenticated users can view
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

-- Policy 2: INSERT - Service role can upload (CRITICAL!)
CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role  -- ⚠️ Must be service_role for backend uploads
WITH CHECK (bucket_id = 'session-recordings');

-- Policy 3: UPDATE - Authenticated users can update
CREATE POLICY "Authenticated users can update session recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'session-recordings')
WITH CHECK (bucket_id = 'session-recordings');

-- Policy 4: DELETE - Authenticated users can delete
CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');

-- Step 4: Verify policies were created correctly
SELECT 
  policyname,
  roles,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' AND roles = ARRAY['service_role'] THEN '✅ CORRECT'
    WHEN cmd = 'INSERT' AND roles = ARRAY['authenticated'] THEN '❌ WRONG - Must be service_role'
    WHEN cmd != 'INSERT' THEN '✅ OK'
    ELSE '❓ CHECK'
  END as status
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%session%recording%'
ORDER BY cmd;

-- Expected result:
-- SELECT should show: ✅ OK
-- INSERT should show: ✅ CORRECT (with service_role)
-- UPDATE should show: ✅ OK  
-- DELETE should show: ✅ OK
