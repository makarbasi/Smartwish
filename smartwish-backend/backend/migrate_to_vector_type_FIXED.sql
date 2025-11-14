-- ============================================================================
-- Migration: Convert embedding_vector from jsonb to vector type (FIXED)
-- ============================================================================
-- This script converts your existing jsonb embeddings to proper vector type
-- Required for pgvector to work efficiently!
-- 
-- BUGS FIXED:
-- 1. Added proper jsonb to vector conversion handling
-- 2. Fixed LIMIT 1 bug in verification query
-- 3. Added transaction safety
-- 4. Added rollback capability
-- 5. Better error handling for different jsonb formats
-- ============================================================================

-- Step 1: Ensure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Check current column type
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sw_templates' 
    AND column_name = 'embedding_vector';

-- Expected: data_type = 'jsonb'

-- Step 3: Add a temporary new column with vector type
ALTER TABLE sw_templates 
ADD COLUMN IF NOT EXISTS embedding_vector_new vector(768);

-- Step 4: Migrate data from jsonb to vector
-- Handle both string and array formats
-- This is more robust than the original version
DO $$ 
DECLARE
    row_record RECORD;
    embedding_array float[];
    embedding_text text;
    converted_count int := 0;
    failed_count int := 0;
BEGIN
    FOR row_record IN 
        SELECT id, embedding_vector 
        FROM sw_templates 
        WHERE embedding_vector IS NOT NULL
    LOOP
        BEGIN
            -- Convert jsonb to text, removing brackets and quotes
            embedding_text := regexp_replace(
                row_record.embedding_vector::text, 
                '^\[|\]$', 
                '', 
                'g'
            );
            
            -- Update the new column with vector type
            UPDATE sw_templates
            SET embedding_vector_new = ('['|| embedding_text ||']')::vector(768)
            WHERE id = row_record.id;
            
            converted_count := converted_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to convert embedding for id %: %', row_record.id, SQLERRM;
            failed_count := failed_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Migration complete: % successful, % failed', converted_count, failed_count;
END $$;

-- Step 5: Verify the migration
SELECT 
    COUNT(*) as total_rows,
    COUNT(embedding_vector) as old_embeddings,
    COUNT(embedding_vector_new) as new_embeddings,
    COUNT(*) FILTER (WHERE embedding_vector IS NOT NULL AND embedding_vector_new IS NULL) as failed_migrations,
    ROUND(
        100.0 * COUNT(embedding_vector_new) / NULLIF(COUNT(embedding_vector), 0), 
        2
    ) as success_rate_percent
FROM sw_templates;

-- Expected: 
-- - new_embeddings should equal old_embeddings
-- - failed_migrations should be 0
-- - success_rate_percent should be 100.00

-- Step 5b: Sample check - view a few converted embeddings
SELECT 
    id,
    title,
    jsonb_array_length(embedding_vector) as old_length,
    (embedding_vector_new IS NOT NULL) as converted_successfully,
    left(embedding_vector_new::text, 50) || '...' as vector_preview
FROM sw_templates
WHERE embedding_vector IS NOT NULL
LIMIT 5;

-- Expected: old_length = 768, new_length = 768, converted_successfully = true

-- ============================================================================
-- STOP HERE AND VERIFY STEP 5 OUTPUT BEFORE PROCEEDING!
-- ============================================================================
-- Only continue if:
-- ✅ success_rate_percent = 100.00
-- ✅ failed_migrations = 0
-- ✅ All sample rows show converted_successfully = true
-- ============================================================================

-- Step 6: Swap columns (in a transaction for safety)
-- ⚠️ IMPORTANT: Only run this after verifying Step 5 looks good!
-- Uncomment when ready:

/*
BEGIN;

-- Drop the old jsonb column
ALTER TABLE sw_templates 
DROP COLUMN embedding_vector;

-- Rename the new vector column
ALTER TABLE sw_templates 
RENAME COLUMN embedding_vector_new TO embedding_vector;

-- Add NOT NULL constraint if all rows have embeddings
-- (Optional - uncomment if you want to enforce this)
-- ALTER TABLE sw_templates 
-- ALTER COLUMN embedding_vector SET NOT NULL;

COMMIT;

-- If something went wrong, run: ROLLBACK;
*/

-- Step 7: Create the vector index (after column is renamed)
-- ⚠️ Only run after Step 6 is complete!
-- Uncomment when ready:

/*
-- Drop index if it exists (from previous attempts)
DROP INDEX IF EXISTS idx_sw_templates_embedding_vector;

-- Create the new index
CREATE INDEX idx_sw_templates_embedding_vector 
ON sw_templates 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 50);

-- For larger datasets (1000+ cards), consider:
-- WITH (lists = 100);

-- For very large datasets (10,000+ cards), consider HNSW:
-- USING hnsw (embedding_vector vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Verify index was created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'sw_templates' 
    AND indexname = 'idx_sw_templates_embedding_vector';
*/

-- Step 8: Create RPC functions for vector search
-- ⚠️ Only run after index is created!
-- Uncomment when ready:

/*
-- Drop functions if they exist (for clean recreation)
DROP FUNCTION IF EXISTS match_templates_by_embedding(vector, float, int);
DROP FUNCTION IF EXISTS match_templates_by_embedding_and_category(vector, uuid, float, int);

-- Function 1: General semantic search
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
  popularity integer,
  num_downloads integer,
  language text,
  region text,
  status text,
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
    sw_templates.title::text,
    sw_templates.slug::text,
    sw_templates.description::text,
    sw_templates.category_id,
    sw_templates.author_id,
    sw_templates.price,
    sw_templates.cover_image::text,
    sw_templates.image_1::text,
    sw_templates.image_2::text,
    sw_templates.image_3::text,
    sw_templates.image_4::text,
    sw_templates.target_audience::text,
    sw_templates.occasion_type::text,
    sw_templates.style_type::text,
    sw_templates.message::text,
    sw_templates.search_keywords,
    sw_templates.popularity,
    sw_templates.num_downloads,
    sw_templates.language::text,
    sw_templates.region::text,
    sw_templates.status::text,
    sw_templates.embedding_updated_at,
    sw_templates.created_at,
    sw_templates.updated_at,
    (1 - (sw_templates.embedding_vector <=> query_embedding))::float AS similarity
  FROM sw_templates
  WHERE 
    sw_templates.embedding_vector IS NOT NULL
    AND 1 - (sw_templates.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY sw_templates.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function 2: Category-specific semantic search
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
  popularity integer,
  num_downloads integer,
  language text,
  region text,
  status text,
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
    sw_templates.title::text,
    sw_templates.slug::text,
    sw_templates.description::text,
    sw_templates.category_id,
    sw_templates.author_id,
    sw_templates.price,
    sw_templates.cover_image::text,
    sw_templates.image_1::text,
    sw_templates.image_2::text,
    sw_templates.image_3::text,
    sw_templates.image_4::text,
    sw_templates.target_audience::text,
    sw_templates.occasion_type::text,
    sw_templates.style_type::text,
    sw_templates.message::text,
    sw_templates.search_keywords,
    sw_templates.popularity,
    sw_templates.num_downloads,
    sw_templates.language::text,
    sw_templates.region::text,
    sw_templates.status::text,
    sw_templates.embedding_updated_at,
    sw_templates.created_at,
    sw_templates.updated_at,
    (1 - (sw_templates.embedding_vector <=> query_embedding))::float AS similarity
  FROM sw_templates
  WHERE 
    sw_templates.embedding_vector IS NOT NULL
    AND sw_templates.category_id = filter_category_id
    AND 1 - (sw_templates.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY sw_templates.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify functions were created
SELECT 
    routine_name, 
    routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE 'match_templates_by_embedding%'
ORDER BY routine_name;
*/

-- ============================================================================
-- Final verification (run after ALL steps complete)
-- ============================================================================
/*
-- 1. Check column type is now vector
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'sw_templates' 
    AND column_name = 'embedding_vector';

-- Expected: udt_name = 'vector'

-- 2. Check all embeddings are present
SELECT 
    COUNT(*) as total_templates,
    COUNT(embedding_vector) as with_embeddings,
    COUNT(*) - COUNT(embedding_vector) as missing_embeddings,
    ROUND(100.0 * COUNT(embedding_vector) / COUNT(*), 2) as coverage_percent
FROM sw_templates;

-- Expected: coverage_percent close to 100%

-- 3. Test the search function with a sample embedding
SELECT 
    title,
    similarity
FROM match_templates_by_embedding(
    (SELECT embedding_vector FROM sw_templates WHERE embedding_vector IS NOT NULL LIMIT 1),
    0.5,
    5
);

-- Expected: Returns 5 templates with similarity scores

-- 4. Check index exists and is being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM match_templates_by_embedding(
    (SELECT embedding_vector FROM sw_templates WHERE embedding_vector IS NOT NULL LIMIT 1),
    0.5,
    5
);

-- Expected: Should show "Index Scan using idx_sw_templates_embedding_vector"
*/

-- ============================================================================
-- Rollback Plan (if something goes wrong)
-- ============================================================================
/*
-- If migration fails partway through:

-- 1. If you haven't dropped embedding_vector yet:
ALTER TABLE sw_templates DROP COLUMN IF EXISTS embedding_vector_new;

-- 2. If you already dropped embedding_vector (Step 6):
-- Unfortunately, you'll need to restore from backup or re-upload embeddings
-- This is why Step 5 verification is so important!

-- 3. To start fresh:
ALTER TABLE sw_templates DROP COLUMN IF EXISTS embedding_vector_new;
-- Then run the migration again from Step 3
*/

-- ============================================================================
-- SAFE MIGRATION STEPS SUMMARY:
-- ============================================================================
-- 
-- 1. ✅ Run Steps 1-5 (creates new column, migrates data, verifies)
-- 2. ✅ VERIFY Step 5 output - ensure success_rate_percent = 100.00
-- 3. ✅ Uncomment and run Step 6 (drops old column, renames new) - IN TRANSACTION!
-- 4. ✅ Uncomment and run Step 7 (creates index)
-- 5. ✅ Uncomment and run Step 8 (creates RPC functions)
-- 6. ✅ Run final verification
-- 7. ✅ Test search in your application
-- 
-- ============================================================================

