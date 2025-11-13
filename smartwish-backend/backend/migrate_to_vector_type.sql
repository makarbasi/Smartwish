-- ============================================================================
-- Migration: Convert embedding_vector from jsonb to vector type
-- ============================================================================
-- This script converts your existing jsonb embeddings to proper vector type
-- Required for pgvector to work efficiently!
-- ============================================================================

-- Step 1: Ensure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Check current column type
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'sw_templates' 
    AND column_name = 'embedding_vector';

-- Step 3: Add a temporary new column with vector type
ALTER TABLE sw_templates 
ADD COLUMN IF NOT EXISTS embedding_vector_new vector(768);

-- Step 4: Migrate data from jsonb to vector
-- This converts JSON arrays like [0.1, 0.2, ...] to vector type
UPDATE sw_templates
SET embedding_vector_new = (embedding_vector::text)::vector(768)
WHERE embedding_vector IS NOT NULL
  AND embedding_vector != 'null'::jsonb
  AND jsonb_array_length(embedding_vector) = 768;

-- Step 5: Verify the migration
SELECT 
    COUNT(*) as total_rows,
    COUNT(embedding_vector) as old_embeddings,
    COUNT(embedding_vector_new) as new_embeddings,
    COUNT(*) FILTER (WHERE embedding_vector IS NOT NULL AND embedding_vector_new IS NULL) as failed_migrations
FROM sw_templates;

-- Expected: new_embeddings should equal old_embeddings, failed_migrations should be 0

-- Step 6: Drop old column and rename new one
-- ⚠️ IMPORTANT: Only run this after verifying Step 5 looks good!
-- Uncomment these lines when ready:

/*
ALTER TABLE sw_templates 
DROP COLUMN embedding_vector;

ALTER TABLE sw_templates 
RENAME COLUMN embedding_vector_new TO embedding_vector;
*/

-- Step 7: Create the vector index (after column is renamed)
-- ⚠️ Only run after Steps 6 is complete!
-- Uncomment when ready:

/*
CREATE INDEX idx_sw_templates_embedding_vector 
ON sw_templates 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 50);
*/

-- Step 8: Create RPC functions for vector search
-- ⚠️ Only run after index is created!
-- Uncomment when ready:

/*
CREATE OR REPLACE FUNCTION match_templates_by_embedding(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  description text,
  category_id uuid,
  author_id uuid,
  price numeric,
  cover_image text,
  image_1 text,
  image_2 text,
  image_3 text,
  image_4 text,
  target_audience text,
  occasion_type text,
  style_type text,
  message text,
  search_keywords text[],
  embedding_updated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sw_templates.id,
    sw_templates.title,
    sw_templates.slug,
    sw_templates.description,
    sw_templates.category_id,
    sw_templates.author_id,
    sw_templates.price,
    sw_templates.cover_image,
    sw_templates.image_1,
    sw_templates.image_2,
    sw_templates.image_3,
    sw_templates.image_4,
    sw_templates.target_audience,
    sw_templates.occasion_type,
    sw_templates.style_type,
    sw_templates.message,
    sw_templates.search_keywords,
    sw_templates.embedding_updated_at,
    sw_templates.created_at,
    sw_templates.updated_at,
    1 - (sw_templates.embedding_vector <=> query_embedding) AS similarity
  FROM sw_templates
  WHERE 
    sw_templates.embedding_vector IS NOT NULL
    AND 1 - (sw_templates.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY sw_templates.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_templates_by_embedding_and_category(
  query_embedding vector(768),
  filter_category_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  description text,
  category_id uuid,
  author_id uuid,
  price numeric,
  cover_image text,
  image_1 text,
  image_2 text,
  image_3 text,
  image_4 text,
  target_audience text,
  occasion_type text,
  style_type text,
  message text,
  search_keywords text[],
  embedding_updated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sw_templates.id,
    sw_templates.title,
    sw_templates.slug,
    sw_templates.description,
    sw_templates.category_id,
    sw_templates.author_id,
    sw_templates.price,
    sw_templates.cover_image,
    sw_templates.image_1,
    sw_templates.image_2,
    sw_templates.image_3,
    sw_templates.image_4,
    sw_templates.target_audience,
    sw_templates.occasion_type,
    sw_templates.style_type,
    sw_templates.message,
    sw_templates.search_keywords,
    sw_templates.embedding_updated_at,
    sw_templates.created_at,
    sw_templates.updated_at,
    1 - (sw_templates.embedding_vector <=> query_embedding) AS similarity
  FROM sw_templates
  WHERE 
    sw_templates.embedding_vector IS NOT NULL
    AND sw_templates.category_id = filter_category_id
    AND 1 - (sw_templates.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY sw_templates.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;
*/

-- ============================================================================
-- SAFE MIGRATION STEPS:
-- ============================================================================
-- 
-- 1. Run Steps 1-5 (creates new column, migrates data, verifies)
-- 2. Check Step 5 output - ensure failed_migrations = 0
-- 3. Uncomment and run Step 6 (drops old column, renames new)
-- 4. Uncomment and run Step 7 (creates index)
-- 5. Uncomment and run Step 8 (creates RPC functions)
-- 
-- ============================================================================

-- Final verification query (run after everything):
/*
SELECT 
    COUNT(*) as total_templates,
    COUNT(embedding_vector) as with_embeddings,
    pg_typeof(embedding_vector) as column_type
FROM sw_templates
LIMIT 1;

-- Should show: column_type = 'vector'
*/

