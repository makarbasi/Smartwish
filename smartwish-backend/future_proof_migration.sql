-- Future-Proof SmartWish Database Migration
-- This script enhances the database for:
-- 1. Users becoming authors and publishing templates
-- 2. Culture/Region/Language support
-- 3. User-generated templates with approval workflow
-- 4. Advanced semantic search and filtering
-- 5. Template moderation system

-- Run this in your Supabase SQL Editor

BEGIN;

-- ================================================================
-- STEP 1: Clean up old store interest tables (if they still exist)
-- ================================================================
DROP TABLE IF EXISTS sw_store_interest_images CASCADE;
DROP TABLE IF EXISTS sw_store_interests CASCADE;

-- ================================================================
-- STEP 2: Create Culture and Region Support
-- ================================================================

-- Cultures table for global template support
CREATE TABLE IF NOT EXISTS sw_cultures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- ISO codes: 'US', 'JP', 'IN', 'BR', etc.
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    flag_emoji VARCHAR(10), -- 🇺🇸, 🇯🇵, 🇮🇳, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Regions table for broader geographical grouping
CREATE TABLE IF NOT EXISTS sw_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- 'NA', 'EU', 'ASIA', 'LATAM', etc.
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- STEP 3: Enhance Users Table for Author Capabilities
-- ================================================================

-- Add author capabilities to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_publish_templates BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_moderate_templates BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS author_profile_id UUID REFERENCES sw_authors(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_templates_published INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_template_downloads INTEGER DEFAULT 0;

-- ================================================================
-- STEP 4: Enhance Authors Table
-- ================================================================

-- Link authors to users (users can become authors)
ALTER TABLE sw_authors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE sw_authors ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE sw_authors ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE sw_authors ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE sw_authors ADD COLUMN IF NOT EXISTS author_stats JSONB DEFAULT '{}';

-- ================================================================
-- STEP 5: Enhance Templates Table
-- ================================================================

-- Add user-generated template support
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS culture_id UUID REFERENCES sw_cultures(id);
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES sw_regions(id);

-- Template approval workflow
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS submission_status VARCHAR(50) DEFAULT 'draft';
-- Status options: draft, submitted, under_review, approved, rejected, published, archived
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES users(id);
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Enhanced metadata
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS target_audience VARCHAR(100); -- 'adults', 'children', 'teens', 'seniors'
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS occasion_type VARCHAR(100); -- 'birthday', 'holiday', 'celebration', 'sympathy'
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS style_type VARCHAR(100); -- 'modern', 'classic', 'minimalist', 'decorative'
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS is_user_generated BOOLEAN DEFAULT false;
ALTER TABLE sw_templates ADD COLUMN IF NOT EXISTS original_saved_design_id UUID REFERENCES saved_designs(id);

-- ================================================================
-- STEP 6: Enhance Saved Designs for Template Conversion
-- ================================================================

-- Add template promotion capabilities
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS is_template_candidate BOOLEAN DEFAULT false;
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS published_as_template_id UUID REFERENCES sw_templates(id);
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS template_submission_status VARCHAR(50) DEFAULT 'design';
-- Status: design, candidate, submitted, approved, rejected, published
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS submission_notes TEXT;
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS target_culture_id UUID REFERENCES sw_cultures(id);
ALTER TABLE saved_designs ADD COLUMN IF NOT EXISTS target_region_id UUID REFERENCES sw_regions(id);

-- ================================================================
-- STEP 7: Create Template Metadata for Advanced Search
-- ================================================================

-- Flexible metadata for templates
CREATE TABLE IF NOT EXISTS sw_template_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, key)
);

-- ================================================================
-- STEP 8: Create Template Review System
-- ================================================================

-- Template moderation history
CREATE TABLE IF NOT EXISTS sw_template_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    reviewer_user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- submitted, approved, rejected, changes_requested, published
    notes TEXT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- STEP 9: Create User Search Preferences
-- ================================================================

-- User search and filter preferences
CREATE TABLE IF NOT EXISTS sw_user_search_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preferred_cultures UUID[] DEFAULT '{}',
    preferred_regions UUID[] DEFAULT '{}',
    preferred_languages VARCHAR(10)[] DEFAULT '{}',
    preferred_categories UUID[] DEFAULT '{}',
    preferred_styles VARCHAR(100)[] DEFAULT '{}',
    preferred_occasions VARCHAR(100)[] DEFAULT '{}',
    price_range_min DECIMAL(10,2) DEFAULT 0,
    price_range_max DECIMAL(10,2),
    exclude_user_generated BOOLEAN DEFAULT false,
    only_verified_authors BOOLEAN DEFAULT false,
    search_history JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ================================================================
-- STEP 10: Create Template Analytics
-- ================================================================

-- Track template performance and user interactions
CREATE TABLE IF NOT EXISTS sw_template_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- view, download, like, share, search_result
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- STEP 11: Create Search Enhancement Tables
-- ================================================================

-- Popular search terms
CREATE TABLE IF NOT EXISTS sw_search_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(255) NOT NULL,
    search_count INTEGER DEFAULT 1,
    result_count INTEGER DEFAULT 0,
    last_searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(term)
);

-- User favorites and collections
CREATE TABLE IF NOT EXISTS sw_user_template_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, template_id)
);

-- ================================================================
-- STEP 12: Create Indexes for Performance
-- ================================================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_can_publish ON users(can_publish_templates) WHERE can_publish_templates = true;
CREATE INDEX IF NOT EXISTS idx_users_can_moderate ON users(can_moderate_templates) WHERE can_moderate_templates = true;
CREATE INDEX IF NOT EXISTS idx_users_author_profile ON users(author_profile_id) WHERE author_profile_id IS NOT NULL;

-- Author-related indexes
CREATE INDEX IF NOT EXISTS idx_sw_authors_user_id ON sw_authors(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_authors_verified ON sw_authors(is_verified) WHERE is_verified = true;

-- Template-related indexes
CREATE INDEX IF NOT EXISTS idx_sw_templates_user_generated ON sw_templates(created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_templates_culture ON sw_templates(culture_id) WHERE culture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_templates_region ON sw_templates(region_id) WHERE region_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_templates_submission_status ON sw_templates(submission_status);
CREATE INDEX IF NOT EXISTS idx_sw_templates_user_generated_flag ON sw_templates(is_user_generated);
CREATE INDEX IF NOT EXISTS idx_sw_templates_target_audience ON sw_templates(target_audience) WHERE target_audience IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_templates_occasion_type ON sw_templates(occasion_type) WHERE occasion_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sw_templates_style_type ON sw_templates(style_type) WHERE style_type IS NOT NULL;

-- Saved designs indexes
CREATE INDEX IF NOT EXISTS idx_saved_designs_template_candidate ON saved_designs(is_template_candidate) WHERE is_template_candidate = true;
CREATE INDEX IF NOT EXISTS idx_saved_designs_submission_status ON saved_designs(template_submission_status);
CREATE INDEX IF NOT EXISTS idx_saved_designs_culture ON saved_designs(target_culture_id) WHERE target_culture_id IS NOT NULL;

-- Metadata and search indexes
CREATE INDEX IF NOT EXISTS idx_sw_template_metadata_key ON sw_template_metadata(key);
CREATE INDEX IF NOT EXISTS idx_sw_template_metadata_template ON sw_template_metadata(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_reviews_template ON sw_template_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_reviews_reviewer ON sw_template_reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_analytics_template ON sw_template_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_analytics_event ON sw_template_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_sw_template_analytics_created ON sw_template_analytics(created_at);

-- Search and favorites indexes
CREATE INDEX IF NOT EXISTS idx_sw_search_terms_count ON sw_search_terms(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_sw_user_favorites_user ON sw_user_template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_user_favorites_template ON sw_user_template_favorites(template_id);

-- ================================================================
-- STEP 13: Insert Sample Data
-- ================================================================

-- Insert sample cultures
INSERT INTO sw_cultures (code, name, display_name, flag_emoji) VALUES
('US', 'united_states', 'United States', '🇺🇸'),
('CA', 'canada', 'Canada', '🇨🇦'),
('GB', 'united_kingdom', 'United Kingdom', '🇬🇧'),
('AU', 'australia', 'Australia', '🇦🇺'),
('DE', 'germany', 'Germany', '🇩🇪'),
('FR', 'france', 'France', '🇫🇷'),
('ES', 'spain', 'Spain', '🇪🇸'),
('IT', 'italy', 'Italy', '🇮🇹'),
('JP', 'japan', 'Japan', '🇯🇵'),
('KR', 'south_korea', 'South Korea', '🇰🇷'),
('CN', 'china', 'China', '🇨🇳'),
('IN', 'india', 'India', '🇮🇳'),
('BR', 'brazil', 'Brazil', '🇧🇷'),
('MX', 'mexico', 'Mexico', '🇲🇽'),
('AR', 'argentina', 'Argentina', '🇦🇷')
ON CONFLICT (code) DO NOTHING;

-- Insert sample regions
INSERT INTO sw_regions (code, name, display_name) VALUES
('NA', 'north_america', 'North America'),
('EU', 'europe', 'Europe'),
('ASIA', 'asia', 'Asia'),
('LATAM', 'latin_america', 'Latin America'),
('OCEANIA', 'oceania', 'Oceania'),
('AFRICA', 'africa', 'Africa'),
('MENA', 'middle_east_north_africa', 'Middle East & North Africa')
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- STEP 14: Create Functions for Common Operations
-- ================================================================

-- Function to promote a saved design to template
CREATE OR REPLACE FUNCTION promote_design_to_template(
    design_id UUID,
    title VARCHAR(255),
    description TEXT,
    category_id UUID,
    price DECIMAL(10,2) DEFAULT 0,
    culture_code VARCHAR(10) DEFAULT 'US',
    region_code VARCHAR(10) DEFAULT 'NA'
) RETURNS UUID AS $$
DECLARE
    template_id UUID;
    culture_uuid UUID;
    region_uuid UUID;
    user_uuid UUID;
BEGIN
    -- Get culture and region UUIDs
    SELECT id INTO culture_uuid FROM sw_cultures WHERE code = culture_code;
    SELECT id INTO region_uuid FROM sw_regions WHERE code = region_code;
    
    -- Get user from saved design
    SELECT user_id INTO user_uuid FROM saved_designs WHERE id = design_id;
    
    -- Create new template
    INSERT INTO sw_templates (
        slug, title, description, category_id, created_by_user_id, 
        culture_id, region_id, price, language, status, submission_status,
        is_user_generated, original_saved_design_id, submitted_at
    ) VALUES (
        lower(replace(title, ' ', '-')) || '-' || extract(epoch from now())::text,
        title, description, category_id, user_uuid,
        culture_uuid, region_uuid, price, 'en', 'draft', 'submitted',
        true, design_id, NOW()
    ) RETURNING id INTO template_id;
    
    -- Update saved design
    UPDATE saved_designs 
    SET published_as_template_id = template_id,
        template_submission_status = 'submitted',
        is_template_candidate = true
    WHERE id = design_id;
    
    -- Log the review
    INSERT INTO sw_template_reviews (template_id, action, notes, new_status)
    VALUES (template_id, 'submitted', 'Design promoted to template', 'submitted');
    
    RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to approve a template
CREATE OR REPLACE FUNCTION approve_template(
    template_id UUID,
    reviewer_id UUID,
    notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update template status
    UPDATE sw_templates 
    SET submission_status = 'approved',
        status = 'published',
        reviewed_at = NOW(),
        reviewed_by_user_id = reviewer_id,
        review_notes = notes,
        published_at = NOW()
    WHERE id = template_id;
    
    -- Log the review
    INSERT INTO sw_template_reviews (template_id, reviewer_user_id, action, notes, previous_status, new_status)
    VALUES (template_id, reviewer_id, 'approved', notes, 'submitted', 'approved');
    
    -- Update user stats
    UPDATE users 
    SET total_templates_published = total_templates_published + 1
    WHERE id = (SELECT created_by_user_id FROM sw_templates WHERE id = template_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- STEP 15: Create RLS Policies
-- ================================================================

-- Enable RLS on new tables
ALTER TABLE sw_cultures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_user_search_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_user_template_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access for cultures" ON sw_cultures FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for regions" ON sw_regions FOR SELECT USING (is_active = true);

-- Create policies for user data
CREATE POLICY "Users can manage own search preferences" ON sw_user_search_preferences 
    FOR ALL USING (auth.uid()::text = user_id::text);
    
CREATE POLICY "Users can manage own favorites" ON sw_user_template_favorites 
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Create policies for template reviews (moderators only)
CREATE POLICY "Moderators can manage template reviews" ON sw_template_reviews 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND can_moderate_templates = true
        )
    );

COMMIT;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'sw_%'
ORDER BY table_name;

-- Verify new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sw_templates'
AND column_name IN ('created_by_user_id', 'culture_id', 'region_id', 'submission_status', 'is_user_generated')
ORDER BY column_name;

-- Show sample cultures and regions
SELECT 'Cultures' as type, code, display_name FROM sw_cultures WHERE is_active = true
UNION ALL
SELECT 'Regions' as type, code, display_name FROM sw_regions WHERE is_active = true
ORDER BY type, display_name;
