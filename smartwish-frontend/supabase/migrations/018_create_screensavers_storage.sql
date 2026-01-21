-- Migration: Create screensavers storage bucket
-- This bucket stores HTML screen saver files for kiosks

-- Create the screensavers bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screensavers',
  'screensavers',
  true,  -- Public bucket for easy access from kiosks
  5242880,  -- 5MB max file size
  ARRAY['text/html', 'video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['text/html', 'video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Policy: Allow public read access to all files in the bucket
CREATE POLICY "Public read access for screensavers"
ON storage.objects FOR SELECT
USING (bucket_id = 'screensavers');

-- Policy: Allow authenticated users (admins) to upload files
CREATE POLICY "Authenticated users can upload screensavers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screensavers');

-- Policy: Allow authenticated users (admins) to update files
CREATE POLICY "Authenticated users can update screensavers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'screensavers');

-- Policy: Allow authenticated users (admins) to delete files
CREATE POLICY "Authenticated users can delete screensavers"
ON storage.objects FOR DELETE
USING (bucket_id = 'screensavers');
