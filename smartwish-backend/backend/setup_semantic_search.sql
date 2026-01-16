-- ============================================================================
-- Semantic Search Setup for sw_templates
-- ============================================================================
-- This file sets up efficient vector similarity search using pgvector
-- 
-- Run this in your Supabase SQL Editor to enable semantic search
-- ============================================================================

-- 1. Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create index on embedding_vector for fast similarity search
-- Using ivfflat (Inverted File with Flat Compression) for efficient search
-- The lists parameter should be approximately sqrt(total_rows)
-- For ~200 cards, lists=15 is reasonable; adjust as your data grows

DROP INDEX IF EXISTS idx_sw_templates_embedding_vector;

CREATE INDEX idx_sw_templates_embedding_vector 
ON sw_templates 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 50);

-- Note: For very large datasets (100k+ cards), consider using HNSW instead:
-- CREATE INDEX idx_sw_templates_embedding_vector 
-- ON sw_templates 
-- USING hnsw (embedding_vector vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- 3. Create RPC function for efficient vector similarity search
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

-- 4. Create function for category-specific semantic search
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

-- 5. Verify setup
SELECT 
  'Vector Extension' as component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN '✅ Installed' ELSE '❌ Not installed' END as status;

SELECT 
  'Embedding Index' as component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_sw_templates_embedding_vector'
  ) THEN '✅ Created' ELSE '❌ Not created' END as status;

SELECT 
  'RPC Function' as component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_templates_by_embedding'
  ) THEN '✅ Created' ELSE '❌ Not created' END as status;

-- 6. Test query (uncomment to test)
-- Replace the vector with an actual embedding from your table
/*
SELECT * FROM match_templates_by_embedding(
  (SELECT embedding_vector FROM sw_templates LIMIT 1),
  0.5,
  5
);
*/

-- ============================================================================
-- Performance Notes:
-- ============================================================================
-- 
-- 1. The <=> operator is the cosine distance operator
--    - Returns value between 0 and 2
--    - 0 = identical, 2 = opposite
--    - We convert to similarity: 1 - distance
--
-- 2. Index maintenance:
--    - The ivfflat index needs occasional rebuilding: REINDEX INDEX idx_sw_templates_embedding_vector;
--    - Do this after bulk inserts or if search slows down
--
-- 3. Query performance:
--    - With index: ~10-50ms for 200 cards
--    - Without index: ~200-500ms
--    - Scales logarithmically with proper indexing
--
-- 4. For production with 10k+ cards:
--    - Consider HNSW index (more memory, faster search)
--    - Adjust lists parameter based on card count
--    - Monitor query performance and adjust accordingly
--
-- ============================================================================

