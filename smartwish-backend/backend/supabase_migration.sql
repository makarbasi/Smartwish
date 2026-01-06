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

-- ----------------------------------------
-- Kiosk configuration (per-device settings)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS kiosk_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id VARCHAR(128) UNIQUE NOT NULL,
    store_id VARCHAR(128),
    name VARCHAR(255),
    api_key VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kiosk_configs_kiosk_id ON kiosk_configs(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_configs_updated_at ON kiosk_configs(updated_at DESC);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_kiosk_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kiosk_configs_updated_at ON kiosk_configs;
CREATE TRIGGER trg_kiosk_configs_updated_at
BEFORE UPDATE ON kiosk_configs
FOR EACH ROW
EXECUTE FUNCTION update_kiosk_configs_updated_at();

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

-- ----------------------------------------
-- Multi-tenant Kiosk Management System
-- ----------------------------------------

-- Add 'manager' role to user_role enum (required for kiosk managers)
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction, so run this separately if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'manager';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Extend kiosk_configs table with activation status and creator tracking
ALTER TABLE kiosk_configs 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kiosk_configs_is_active ON kiosk_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_kiosk_configs_created_by ON kiosk_configs(created_by);

-- Junction table for many-to-many relationship between kiosks and managers
CREATE TABLE IF NOT EXISTS kiosk_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID NOT NULL REFERENCES kiosk_configs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(kiosk_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kiosk_managers_user ON kiosk_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_managers_kiosk ON kiosk_managers(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_managers_assigned_by ON kiosk_managers(assigned_by);

-- Enable Supabase Realtime on kiosk_configs for live config updates
-- Note: Run this only if you're using Supabase. Skip if using plain PostgreSQL.
-- ALTER PUBLICATION supabase_realtime ADD TABLE kiosk_configs;

-- ----------------------------------------
-- Kiosk Print Logs (for manager tracking)
-- ----------------------------------------

CREATE TABLE IF NOT EXISTS kiosk_print_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID NOT NULL REFERENCES kiosk_configs(id) ON DELETE CASCADE,
    
    -- What was printed
    product_type VARCHAR(50) NOT NULL DEFAULT 'greeting-card', -- 'greeting-card', 'sticker', 'photo', 'label'
    product_id VARCHAR(255), -- ID of the card/design that was printed (if applicable)
    product_name VARCHAR(255), -- Name of the product for display
    
    -- Print details
    paper_type VARCHAR(50), -- 'greeting-card', 'sticker', 'photo', etc.
    paper_size VARCHAR(50), -- 'letter', 'a4', '4x6', etc.
    tray_number INTEGER,
    copies INTEGER DEFAULT 1,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Optional: who initiated the print (could be a customer at the kiosk)
    initiated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kiosk_print_logs_kiosk ON kiosk_print_logs(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_print_logs_status ON kiosk_print_logs(status);
CREATE INDEX IF NOT EXISTS idx_kiosk_print_logs_created ON kiosk_print_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_print_logs_product_type ON kiosk_print_logs(product_type);

-- View for managers to see their kiosk print logs
CREATE OR REPLACE VIEW manager_kiosk_print_logs AS
SELECT 
    pl.*,
    kc.name as kiosk_name,
    kc.store_id,
    km.user_id as manager_id
FROM kiosk_print_logs pl
JOIN kiosk_configs kc ON pl.kiosk_id = kc.id
JOIN kiosk_managers km ON kc.id = km.kiosk_id;

-- Grant access to authenticated users (managers will filter by their user_id)
GRANT SELECT ON manager_kiosk_print_logs TO authenticated;