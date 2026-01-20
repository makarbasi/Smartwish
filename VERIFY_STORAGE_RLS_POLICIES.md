# Verify Storage RLS Policies Guide

## Quick Check (Run in Supabase SQL Editor)

### Step 1: Check Bucket Exists
```sql
SELECT name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'session-recordings';
```

### Step 2: Check Existing Policies
```sql
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
    policyname LIKE '%session%recording%' 
    OR policyname LIKE '%session-recordings%'
  )
ORDER BY policyname;
```

### Step 3: Check if RLS is Enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';
```

Should return: `rowsecurity = true`

## Required Policies

You need these 4 policies for session recordings to work:

### 1. SELECT (View) - Authenticated Users
**Purpose**: Allows authenticated users (admin panel) to view recordings

**Check if exists**:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can view session recordings';
```

**Create if missing**:
```sql
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');
```

### 2. INSERT (Upload) - Service Role ⚠️ CRITICAL
**Purpose**: Allows backend (using service_role) to upload files

**Check if exists**:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname = 'Service role can upload session recordings';
```

**Create if missing**:
```sql
CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role  -- ⚠️ Must be service_role, NOT authenticated!
WITH CHECK (bucket_id = 'session-recordings');
```

**⚠️ IMPORTANT**: This MUST use `service_role`, not `authenticated`. The backend uses service_role key to upload.

### 3. UPDATE - Authenticated Users (Optional but Recommended)
**Purpose**: Allows updating file metadata

**Create**:
```sql
CREATE POLICY "Authenticated users can update session recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'session-recordings')
WITH CHECK (bucket_id = 'session-recordings');
```

### 4. DELETE - Authenticated Users
**Purpose**: Allows deleting recordings from admin panel

**Check if exists**:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can delete session recordings';
```

**Create if missing**:
```sql
CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');
```

## Common Issues

### Issue 1: Upload Policy Uses Wrong Role
**Symptom**: Backend can't upload (gets permission denied)

**Check**:
```sql
SELECT policyname, roles, cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND policyname LIKE '%session%recording%';
```

**Should show**: `roles = {service_role}`

**If it shows**: `roles = {authenticated}` - **THIS IS WRONG!**

**Fix**: Drop and recreate:
```sql
DROP POLICY IF EXISTS "Service role can upload session recordings" ON storage.objects;

CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'session-recordings');
```

### Issue 2: No Policies Exist
**Symptom**: Can't access files at all

**Fix**: Run all 4 CREATE POLICY statements above

### Issue 3: RLS Not Enabled
**Symptom**: All access denied

**Check**:
```sql
SELECT rowsecurity FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';
```

**Should be**: `true`

**If false**: RLS should already be enabled on storage.objects by default in Supabase. If not, contact Supabase support.

## Complete Setup Script

Run this entire script to set up policies correctly:

```sql
-- Ensure bucket exists (should already exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-recordings', 
    'session-recordings', 
    false,
    104857600,  -- 100MB
    ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png', 'application/json'];

-- Drop existing policies first (to recreate them correctly)
-- This avoids "already exists" errors
DROP POLICY IF EXISTS "Authenticated users can view session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update session recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete session recordings" ON storage.objects;

-- Create policies
CREATE POLICY "Authenticated users can view session recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-recordings');

CREATE POLICY "Service role can upload session recordings"
ON storage.objects FOR INSERT
TO service_role  -- ⚠️ CRITICAL: Must be service_role
WITH CHECK (bucket_id = 'session-recordings');

CREATE POLICY "Authenticated users can update session recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'session-recordings')
WITH CHECK (bucket_id = 'session-recordings');

CREATE POLICY "Authenticated users can delete session recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-recordings');

-- Verify policies were created
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%session%recording%'
ORDER BY cmd;
```

## Expected Result

After running the setup, you should see:

```
policyname                                         | roles        | cmd
---------------------------------------------------|--------------|-----
Authenticated users can view session recordings   | {authenticated} | SELECT
Service role can upload session recordings        | {service_role}  | INSERT
Authenticated users can update session recordings | {authenticated} | UPDATE
Authenticated users can delete session recordings | {authenticated} | DELETE
```

## Testing

After setting up policies:

1. **Test Upload**: Start a kiosk session and end it. Check backend logs for `[Upload]` messages
2. **Test View**: Go to admin panel → Sessions → Click "Watch" on a recording
3. **Check Storage**: Go to Supabase Dashboard → Storage → session-recordings → videos/ folder

If uploads still fail, check backend logs for the specific error message.
