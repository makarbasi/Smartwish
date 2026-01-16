-- ============================================================================
-- Supabase Database Setup for sw_templates
-- ============================================================================
-- This file contains SQL commands to set up the required tables and data
-- for the sw_templates update script.
--
-- Run these commands in your Supabase SQL Editor if tables don't exist.
-- ============================================================================

-- ============================================================================
-- 1. Create sw_categories table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sw_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO sw_categories (name, slug, description, display_order)
VALUES 
    ('Birthday', 'birthday', 'Birthday greeting cards', 1),
    ('Thankyou', 'thankyou', 'Thank you cards', 2),
    ('Congratulations', 'congratulations', 'Congratulations cards', 3),
    ('Graduation', 'graduation', 'Graduation celebration cards', 4),
    ('Holidays', 'holidays', 'Holiday greeting cards', 5),
    ('Thanksgiving', 'thanksgiving', 'Thanksgiving cards', 6),
    ('Anniversary', 'anniversary', 'Anniversary celebration cards', 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. Create sw_authors table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sw_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    bio TEXT,
    website VARCHAR(500),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default author
INSERT INTO sw_authors (name, bio, is_verified)
VALUES ('Smartwish Studio', 'Official SmartWish card designer', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. Create sw_templates table (if not exists)
-- ============================================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sw_templates (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    
    -- Foreign Keys
    category_id UUID REFERENCES sw_categories(id) ON DELETE SET NULL,
    author_id UUID REFERENCES sw_authors(id) ON DELETE SET NULL,
    
    -- Pricing
    price DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Images
    cover_image TEXT,
    image_1 TEXT,
    image_2 TEXT,
    image_3 TEXT,
    image_4 TEXT,
    
    -- Metadata
    target_audience TEXT,
    occasion_type VARCHAR(100),
    style_type VARCHAR(100),
    message TEXT,
    search_keywords TEXT[],
    
    -- AI Embeddings (768 dimensions for Gemini embedding-001)
    embedding_vector VECTOR(768),
    embedding_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_featured BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. Create Indexes for Better Performance
-- ============================================================================

-- Index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_sw_templates_slug ON sw_templates(slug);

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_sw_templates_category ON sw_templates(category_id);

-- Index on author for filtering
CREATE INDEX IF NOT EXISTS idx_sw_templates_author ON sw_templates(author_id);

-- Index on status for filtering published cards
CREATE INDEX IF NOT EXISTS idx_sw_templates_status ON sw_templates(status);

-- Index on occasion_type for filtering
CREATE INDEX IF NOT EXISTS idx_sw_templates_occasion ON sw_templates(occasion_type);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_sw_templates_created ON sw_templates(created_at DESC);

-- HNSW index for vector similarity search (for embeddings)
-- This enables fast semantic search on embeddings
CREATE INDEX IF NOT EXISTS idx_sw_templates_embedding 
ON sw_templates 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- 5. Create Update Trigger (auto-update updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to sw_templates
DROP TRIGGER IF EXISTS update_sw_templates_updated_at ON sw_templates;
CREATE TRIGGER update_sw_templates_updated_at
    BEFORE UPDATE ON sw_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sw_categories
DROP TRIGGER IF EXISTS update_sw_categories_updated_at ON sw_categories;
CREATE TRIGGER update_sw_categories_updated_at
    BEFORE UPDATE ON sw_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sw_authors
DROP TRIGGER IF EXISTS update_sw_authors_updated_at ON sw_authors;
CREATE TRIGGER update_sw_authors_updated_at
    BEFORE UPDATE ON sw_authors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Verification Queries
-- ============================================================================

-- Count categories
SELECT 'Categories' as table_name, COUNT(*) as count FROM sw_categories;

-- List all categories
SELECT id, name, slug, is_active FROM sw_categories ORDER BY display_order;

-- Count authors
SELECT 'Authors' as table_name, COUNT(*) as count FROM sw_authors;

-- List all authors
SELECT id, name, is_verified FROM sw_authors;

-- Count templates (will be 0 before running update script)
SELECT 'Templates' as table_name, COUNT(*) as count FROM sw_templates;

-- ============================================================================
-- 7. Post-Upload Verification Queries
-- ============================================================================

-- Count total templates
SELECT COUNT(*) as total_templates FROM sw_templates;

-- Count by category
SELECT 
    c.name as category,
    COUNT(t.id) as card_count
FROM sw_categories c
LEFT JOIN sw_templates t ON c.id = t.category_id
GROUP BY c.id, c.name
ORDER BY card_count DESC;

-- Count by author
SELECT 
    a.name as author,
    COUNT(t.id) as card_count
FROM sw_authors a
LEFT JOIN sw_templates t ON a.id = t.author_id
GROUP BY a.id, a.name
ORDER BY card_count DESC;

-- Recent uploads (top 10)
SELECT 
    t.title,
    c.name as category,
    t.created_at
FROM sw_templates t
LEFT JOIN sw_categories c ON t.category_id = c.id
ORDER BY t.created_at DESC
LIMIT 10;

-- Check embeddings
SELECT 
    title,
    ARRAY_LENGTH(embedding_vector, 1) as embedding_dimensions,
    embedding_updated_at
FROM sw_templates
WHERE embedding_vector IS NOT NULL
LIMIT 10;

-- Cards without embeddings
SELECT 
    COUNT(*) as cards_without_embeddings
FROM sw_templates
WHERE embedding_vector IS NULL;

-- ============================================================================
-- 8. Sample Similarity Search Query (using embeddings)
-- ============================================================================

-- Example: Find similar cards to a given embedding
-- Replace the embedding vector with an actual query embedding
/*
SELECT 
    title,
    1 - (embedding_vector <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM sw_templates
WHERE embedding_vector IS NOT NULL
ORDER BY embedding_vector <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
*/

-- ============================================================================
-- 9. Cleanup Queries (use with caution!)
-- ============================================================================

-- Delete all templates (careful!)
-- DELETE FROM sw_templates;

-- Delete templates by category
-- DELETE FROM sw_templates WHERE category_id = (SELECT id FROM sw_categories WHERE name = 'Birthday');

-- Reset auto-increment (if needed)
-- This doesn't apply to UUID-based tables, but included for reference

-- ============================================================================
-- 10. Sample Data Queries
-- ============================================================================

-- Get a full template with all fields
SELECT 
    t.id,
    t.title,
    t.slug,
    t.description,
    c.name as category,
    a.name as author,
    t.price,
    t.cover_image,
    t.target_audience,
    t.occasion_type,
    t.style_type,
    t.message,
    t.search_keywords,
    t.is_featured,
    t.status,
    t.created_at
FROM sw_templates t
LEFT JOIN sw_categories c ON t.category_id = c.id
LEFT JOIN sw_authors a ON t.author_id = a.id
LIMIT 1;

-- Get featured templates
SELECT title, category_id, cover_image
FROM sw_templates
WHERE is_featured = true
ORDER BY created_at DESC;

-- Search by keywords
SELECT title, search_keywords
FROM sw_templates
WHERE 'birthday' = ANY(search_keywords)
LIMIT 10;

-- ============================================================================
-- End of SQL Setup
-- ============================================================================

-- To use this file:
-- 1. Copy relevant sections
-- 2. Paste into Supabase SQL Editor
-- 3. Run to create tables and indexes
-- 4. Verify with the verification queries

