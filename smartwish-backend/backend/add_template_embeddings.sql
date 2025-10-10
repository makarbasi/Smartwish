-- Migration: Add embedding columns for semantic search
-- This enables pre-generated embeddings for faster, more accurate template search

-- Add columns for semantic search
ALTER TABLE sw_templates 
ADD COLUMN IF NOT EXISTS semantic_description TEXT,
ADD COLUMN IF NOT EXISTS embedding_vector JSONB,
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Create index for faster queries on embedding update timestamp
CREATE INDEX IF NOT EXISTS idx_sw_templates_embedding_updated 
ON sw_templates(embedding_updated_at);

-- Add comment to explain the columns
COMMENT ON COLUMN sw_templates.semantic_description IS 'Rich text description combining title, description, keywords, and category for embedding generation';
COMMENT ON COLUMN sw_templates.embedding_vector IS 'Pre-generated embedding vector from Gemini API stored as JSONB array';
COMMENT ON COLUMN sw_templates.embedding_updated_at IS 'Timestamp when the embedding was last generated/updated';

