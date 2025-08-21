-- Migration: Update saved_designs table for template compatibility
-- Copy and paste this entire file into Supabase SQL Editor and run it

-- Add new columns to saved_designs table
ALTER TABLE saved_designs 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES sw_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES sw_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500),
ADD COLUMN IF NOT EXISTS image_1 TEXT,
ADD COLUMN IF NOT EXISTS image_2 TEXT,
ADD COLUMN IF NOT EXISTS image_3 TEXT,
ADD COLUMN IF NOT EXISTS image_4 TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_user_generated BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_version VARCHAR(20) DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES sw_templates(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_designs_template_id ON saved_designs(template_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_category_id ON saved_designs(category_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_author_id ON saved_designs(author_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_created_by_user_id ON saved_designs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_source_template_id ON saved_designs(source_template_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_slug ON saved_designs(slug);
CREATE INDEX IF NOT EXISTS idx_saved_designs_is_featured ON saved_designs(is_featured);
CREATE INDEX IF NOT EXISTS idx_saved_designs_tags ON saved_designs USING GIN(tags);

-- Update existing records
UPDATE saved_designs 
SET created_by_user_id = user_id 
WHERE created_by_user_id IS NULL;

-- Update status constraint
ALTER TABLE saved_designs 
DROP CONSTRAINT IF EXISTS saved_designs_status_check;

ALTER TABLE saved_designs 
ADD CONSTRAINT saved_designs_status_check 
CHECK (status IN ('draft', 'published', 'archived', 'template_candidate', 'published_to_templates'));

-- Create function to copy template to saved design
CREATE OR REPLACE FUNCTION copy_template_to_saved_design(
    p_template_id UUID,
    p_user_id UUID,
    p_title VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_design_id UUID;
    v_template RECORD;
BEGIN
    SELECT * INTO v_template 
    FROM sw_templates 
    WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    INSERT INTO saved_designs (
        user_id,
        title,
        description,
        category,
        design_data,
        thumbnail,
        author,
        price,
        language,
        region,
        search_keywords,
        status,
        template_id,
        slug,
        category_id,
        author_id,
        created_by_user_id,
        cover_image,
        image_1,
        image_2,
        image_3,
        image_4,
        is_featured,
        is_user_generated,
        tags,
        current_version,
        source_template_id
    ) VALUES (
        p_user_id,
        COALESCE(p_title, v_template.title || ' (Copy)'),
        v_template.description,
        COALESCE((SELECT name FROM sw_categories WHERE id = v_template.category_id), 'General'),
        v_template.design_data,
        v_template.cover_image,
        'User',
        v_template.price,
        v_template.language,
        v_template.region,
        v_template.tags,
        'draft',
        p_template_id,
        v_template.slug || '_copy_' || extract(epoch from now())::text,
        v_template.category_id,
        v_template.author_id,
        p_user_id,
        v_template.cover_image,
        v_template.image_1,
        v_template.image_2,
        v_template.image_3,
        v_template.image_4,
        false,
        true,
        v_template.tags,
        v_template.current_version,
        p_template_id
    ) RETURNING id INTO v_design_id;
    
    RETURN v_design_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to publish saved design to templates
CREATE OR REPLACE FUNCTION publish_saved_design_to_templates(
    p_design_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_template_id UUID;
    v_design RECORD;
BEGIN
    SELECT * INTO v_design 
    FROM saved_designs 
    WHERE id = p_design_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Saved design not found or access denied';
    END IF;
    
    INSERT INTO sw_templates (
        slug,
        title,
        description,
        category_id,
        author_id,
        created_by_user_id,
        cover_image,
        image_1,
        image_2,
        image_3,
        image_4,
        design_data,
        price,
        language,
        region,
        is_featured,
        status,
        popularity,
        is_user_generated,
        tags,
        current_version,
        published_at
    ) VALUES (
        COALESCE(v_design.slug, v_design.title || '_' || extract(epoch from now())::text),
        v_design.title,
        v_design.description,
        v_design.category_id,
        v_design.author_id,
        v_design.created_by_user_id,
        v_design.cover_image,
        v_design.image_1,
        v_design.image_2,
        v_design.image_3,
        v_design.image_4,
        v_design.design_data,
        v_design.price,
        v_design.language,
        v_design.region,
        v_design.is_featured,
        'published',
        v_design.popularity,
        v_design.is_user_generated,
        v_design.tags,
        v_design.current_version,
        CURRENT_TIMESTAMP
    ) 
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category_id = EXCLUDED.category_id,
        cover_image = EXCLUDED.cover_image,
        image_1 = EXCLUDED.image_1,
        image_2 = EXCLUDED.image_2,
        image_3 = EXCLUDED.image_3,
        image_4 = EXCLUDED.image_4,
        design_data = EXCLUDED.design_data,
        price = EXCLUDED.price,
        language = EXCLUDED.language,
        region = EXCLUDED.region,
        tags = EXCLUDED.tags,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_template_id;
    
    UPDATE saved_designs 
    SET 
        status = 'published_to_templates',
        template_id = v_template_id,
        published_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_design_id;
    
    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION copy_template_to_saved_design(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_saved_design_to_templates(UUID, UUID) TO authenticated;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view own designs" ON saved_designs;
DROP POLICY IF EXISTS "Users can view published designs" ON saved_designs;

CREATE POLICY "Users can view own designs" ON saved_designs
    FOR SELECT USING (
        auth.uid()::text = user_id::text OR
        auth.uid()::text = created_by_user_id::text OR
        status IN ('published', 'published_to_templates')
    );

CREATE POLICY "Users can view published designs" ON saved_designs
    FOR SELECT USING (status IN ('published', 'published_to_templates'));

-- Create updated view
DROP VIEW IF EXISTS published_designs;
CREATE VIEW published_designs AS
SELECT 
    id,
    user_id,
    title,
    description,
    category,
    design_data,
    thumbnail,
    author,
    upload_time,
    price,
    language,
    region,
    popularity,
    num_downloads,
    search_keywords,
    created_at,
    updated_at,
    template_id,
    slug,
    category_id,
    author_id,
    created_by_user_id,
    cover_image,
    image_1,
    image_2,
    image_3,
    image_4,
    is_featured,
    is_user_generated,
    tags,
    current_version,
    published_at,
    source_template_id
FROM saved_designs 
WHERE status IN ('published', 'published_to_templates');

GRANT SELECT ON published_designs TO authenticated;