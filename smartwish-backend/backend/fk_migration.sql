-- Migration: Update saved_designs foreign key to reference public.users
-- Run this in Supabase SQL Editor

-- Drop existing foreign key constraint that references auth.users
ALTER TABLE saved_designs 
DROP CONSTRAINT IF EXISTS saved_designs_author_id_fkey;

-- Add new foreign key constraint referencing public.users
ALTER TABLE saved_designs 
ADD CONSTRAINT saved_designs_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Verify the constraint was created
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint 
WHERE conname = 'saved_designs_author_id_fkey';
