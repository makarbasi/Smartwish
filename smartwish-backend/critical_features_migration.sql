-- Critical Features Migration: Collections, Revenue Tracking, and Reviews
-- This script adds the most important marketplace features to your SmartWish database
-- Run this AFTER the future_proof_migration.sql

-- Run this in your Supabase SQL Editor

BEGIN;

-- ================================================================
-- SECTION 1: TEMPLATE COLLECTIONS & BUNDLES
-- ================================================================

-- User-created template collections (like playlists for templates)
CREATE TABLE IF NOT EXISTS sw_template_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    cover_template_id UUID REFERENCES sw_templates(id) ON DELETE SET NULL,
    template_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items in each collection
CREATE TABLE IF NOT EXISTS sw_template_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES sw_template_collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, template_id)
);

-- Official template bundles (commercial packages)
CREATE TABLE IF NOT EXISTS sw_template_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bundle_price DECIMAL(10,2) NOT NULL,
    individual_price DECIMAL(10,2) NOT NULL, -- Sum of individual template prices
    discount_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_by_user_id UUID REFERENCES users(id),
    category_id UUID REFERENCES sw_categories(id),
    culture_id UUID REFERENCES sw_cultures(id),
    region_id UUID REFERENCES sw_regions(id),
    cover_image VARCHAR(500),
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates included in each bundle
CREATE TABLE IF NOT EXISTS sw_template_bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID REFERENCES sw_template_bundles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bundle_id, template_id)
);

-- ================================================================
-- SECTION 2: REVENUE & PAYMENT TRACKING
-- ================================================================

-- License types for templates (personal, commercial, extended, etc.)
CREATE TABLE IF NOT EXISTS sw_license_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'personal', 'commercial', 'extended', 'unlimited'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    allows_commercial_use BOOLEAN DEFAULT false,
    allows_redistribution BOOLEAN DEFAULT false,
    allows_resale BOOLEAN DEFAULT false,
    max_usage_count INTEGER, -- NULL = unlimited
    usage_period_days INTEGER, -- NULL = lifetime
    price_multiplier DECIMAL(4,2) DEFAULT 1.0, -- 1.0 = base price, 2.0 = 2x price
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template licenses (what licenses are available for each template)
CREATE TABLE IF NOT EXISTS sw_template_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    license_type_id UUID REFERENCES sw_license_types(id),
    price DECIMAL(10,2) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, license_type_id)
);

-- User purchases (individual templates and bundles)
CREATE TABLE IF NOT EXISTS sw_template_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES sw_templates(id) ON DELETE SET NULL,
    bundle_id UUID REFERENCES sw_template_bundles(id) ON DELETE SET NULL,
    license_type_id UUID REFERENCES sw_license_types(id),
    purchase_type VARCHAR(20) NOT NULL DEFAULT 'template', -- 'template', 'bundle'
    purchase_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50), -- 'stripe', 'paypal', 'apple_pay', etc.
    payment_reference VARCHAR(255),
    usage_count INTEGER DEFAULT 0,
    max_usage_count INTEGER, -- From license type at time of purchase
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For time-limited licenses
    is_active BOOLEAN DEFAULT true,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    refund_date TIMESTAMP WITH TIME ZONE,
    refund_reason TEXT,
    CHECK ((template_id IS NOT NULL AND bundle_id IS NULL) OR (template_id IS NULL AND bundle_id IS NOT NULL))
);

-- Revenue records for tracking platform and author earnings
CREATE TABLE IF NOT EXISTS sw_revenue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES sw_template_purchases(id) ON DELETE CASCADE,
    template_id UUID REFERENCES sw_templates(id) ON DELETE SET NULL,
    bundle_id UUID REFERENCES sw_template_bundles(id) ON DELETE SET NULL,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    platform_fee_percentage DECIMAL(5,2) NOT NULL,
    platform_fee_amount DECIMAL(10,2) NOT NULL,
    author_earnings DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payout_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, on_hold
    payout_date TIMESTAMP WITH TIME ZONE,
    payout_reference VARCHAR(255)
);

-- Author payout records
CREATE TABLE IF NOT EXISTS sw_author_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_earnings DECIMAL(10,2) NOT NULL,
    platform_fees_deducted DECIMAL(10,2) NOT NULL,
    tax_withheld DECIMAL(10,2) DEFAULT 0,
    payout_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payout_method VARCHAR(50), -- 'paypal', 'stripe', 'bank_transfer', 'wise'
    payout_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    payout_date TIMESTAMP WITH TIME ZONE,
    payout_reference VARCHAR(255),
    failure_reason TEXT,
    tax_form_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- SECTION 3: USER REVIEWS & RATINGS
-- ================================================================

-- Template reviews and ratings
CREATE TABLE IF NOT EXISTS sw_template_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(255),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    purchase_id UUID REFERENCES sw_template_purchases(id) ON DELETE SET NULL,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    hidden_reason TEXT,
    hidden_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hidden_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, user_id)
);

-- Rating helpfulness votes (was this review helpful?)
CREATE TABLE IF NOT EXISTS sw_rating_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id UUID REFERENCES sw_template_ratings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rating_id, user_id)
);

-- Bundle reviews (separate from template reviews)
CREATE TABLE IF NOT EXISTS sw_bundle_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID REFERENCES sw_template_bundles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(255),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    purchase_id UUID REFERENCES sw_template_purchases(id) ON DELETE SET NULL,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bundle_id, user_id)
);

-- ================================================================
-- SECTION 4: COMPUTED STATISTICS TABLES
-- ================================================================

-- Template statistics (computed daily)
CREATE TABLE IF NOT EXISTS sw_template_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES sw_templates(id) ON DELETE CASCADE,
    stats_date DATE NOT NULL,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0, -- purchases/views
    UNIQUE(template_id, stats_date)
);

-- Bundle statistics (computed daily)
CREATE TABLE IF NOT EXISTS sw_bundle_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID REFERENCES sw_template_bundles(id) ON DELETE CASCADE,
    stats_date DATE NOT NULL,
    view_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    UNIQUE(bundle_id, stats_date)
);

-- Author statistics (computed monthly)
CREATE TABLE IF NOT EXISTS sw_author_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stats_month DATE NOT NULL, -- First day of month
    templates_published INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    avg_template_rating DECIMAL(3,2) DEFAULT 0,
    total_followers INTEGER DEFAULT 0,
    UNIQUE(author_user_id, stats_month)
);

-- ================================================================
-- SECTION 5: INDEXES FOR PERFORMANCE
-- ================================================================

-- Collection indexes
CREATE INDEX IF NOT EXISTS idx_sw_template_collections_user ON sw_template_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_collections_public ON sw_template_collections(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_sw_template_collection_items_collection ON sw_template_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_collection_items_template ON sw_template_collection_items(template_id);

-- Bundle indexes
CREATE INDEX IF NOT EXISTS idx_sw_template_bundles_active ON sw_template_bundles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sw_template_bundles_featured ON sw_template_bundles(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_sw_template_bundles_category ON sw_template_bundles(category_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_bundles_culture ON sw_template_bundles(culture_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_bundle_items_bundle ON sw_template_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_bundle_items_template ON sw_template_bundle_items(template_id);

-- License and purchase indexes
CREATE INDEX IF NOT EXISTS idx_sw_license_types_active ON sw_license_types(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sw_template_licenses_template ON sw_template_licenses(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_licenses_license_type ON sw_template_licenses(license_type_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_purchases_user ON sw_template_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_purchases_template ON sw_template_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_purchases_bundle ON sw_template_purchases(bundle_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_purchases_date ON sw_template_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sw_template_purchases_active ON sw_template_purchases(is_active) WHERE is_active = true;

-- Revenue indexes
CREATE INDEX IF NOT EXISTS idx_sw_revenue_records_author ON sw_revenue_records(author_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_revenue_records_date ON sw_revenue_records(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sw_revenue_records_payout_status ON sw_revenue_records(payout_status);
CREATE INDEX IF NOT EXISTS idx_sw_author_payouts_author ON sw_author_payouts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_author_payouts_status ON sw_author_payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_sw_author_payouts_date ON sw_author_payouts(period_end);

-- Rating indexes
CREATE INDEX IF NOT EXISTS idx_sw_template_ratings_template ON sw_template_ratings(template_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_ratings_user ON sw_template_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_template_ratings_rating ON sw_template_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_sw_template_ratings_verified ON sw_template_ratings(is_verified_purchase) WHERE is_verified_purchase = true;
CREATE INDEX IF NOT EXISTS idx_sw_template_ratings_visible ON sw_template_ratings(is_hidden) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_sw_rating_votes_rating ON sw_rating_votes(rating_id);
CREATE INDEX IF NOT EXISTS idx_sw_rating_votes_user ON sw_rating_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_bundle_ratings_bundle ON sw_bundle_ratings(bundle_id);
CREATE INDEX IF NOT EXISTS idx_sw_bundle_ratings_user ON sw_bundle_ratings(user_id);

-- Stats indexes
CREATE INDEX IF NOT EXISTS idx_sw_template_stats_template_date ON sw_template_stats(template_id, stats_date);
CREATE INDEX IF NOT EXISTS idx_sw_bundle_stats_bundle_date ON sw_bundle_stats(bundle_id, stats_date);
CREATE INDEX IF NOT EXISTS idx_sw_author_stats_author_month ON sw_author_stats(author_user_id, stats_month);

-- ================================================================
-- SECTION 6: INSERT SAMPLE LICENSE TYPES
-- ================================================================

-- Insert common license types
INSERT INTO sw_license_types (code, name, description, allows_commercial_use, allows_redistribution, allows_resale, price_multiplier, sort_order) VALUES
('personal', 'Personal License', 'For personal use only. Cannot be used for commercial purposes.', false, false, false, 1.0, 1),
('commercial', 'Commercial License', 'For commercial use including business projects and client work.', true, false, false, 2.0, 2),
('extended', 'Extended License', 'Commercial use plus limited redistribution rights.', true, true, false, 3.0, 3),
('unlimited', 'Unlimited License', 'All rights including resale and unlimited redistribution.', true, true, true, 5.0, 4)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- SECTION 7: USEFUL FUNCTIONS
-- ================================================================

-- Function to add template to collection
CREATE OR REPLACE FUNCTION add_template_to_collection(
    collection_id_param UUID,
    template_id_param UUID,
    user_id_param UUID
) RETURNS BOOLEAN AS $$
DECLARE
    collection_owner UUID;
BEGIN
    -- Check if user owns the collection
    SELECT user_id INTO collection_owner 
    FROM sw_template_collections 
    WHERE id = collection_id_param;
    
    IF collection_owner != user_id_param THEN
        RAISE EXCEPTION 'User does not own this collection';
    END IF;
    
    -- Add template to collection
    INSERT INTO sw_template_collection_items (collection_id, template_id)
    VALUES (collection_id_param, template_id_param)
    ON CONFLICT (collection_id, template_id) DO NOTHING;
    
    -- Update collection template count
    UPDATE sw_template_collections 
    SET template_count = (
        SELECT COUNT(*) 
        FROM sw_template_collection_items 
        WHERE collection_id = collection_id_param
    ),
    updated_at = NOW()
    WHERE id = collection_id_param;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to purchase template with license
CREATE OR REPLACE FUNCTION purchase_template(
    user_id_param UUID,
    template_id_param UUID,
    license_type_id_param UUID,
    payment_method_param VARCHAR(50),
    payment_reference_param VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    purchase_id UUID;
    license_price DECIMAL(10,2);
    author_id UUID;
    platform_fee_pct DECIMAL(5,2) := 30.0; -- 30% platform fee
    platform_fee DECIMAL(10,2);
    author_earnings DECIMAL(10,2);
BEGIN
    -- Get license price
    SELECT price INTO license_price
    FROM sw_template_licenses
    WHERE template_id = template_id_param AND license_type_id = license_type_id_param;
    
    IF license_price IS NULL THEN
        RAISE EXCEPTION 'License not available for this template';
    END IF;
    
    -- Get template author
    SELECT COALESCE(created_by_user_id, (SELECT user_id FROM sw_authors WHERE id = author_id)) 
    INTO author_id
    FROM sw_templates 
    WHERE id = template_id_param;
    
    -- Calculate fees
    platform_fee := license_price * (platform_fee_pct / 100);
    author_earnings := license_price - platform_fee;
    
    -- Create purchase record
    INSERT INTO sw_template_purchases (
        user_id, template_id, license_type_id, purchase_type,
        purchase_price, original_price, payment_method, payment_reference
    ) VALUES (
        user_id_param, template_id_param, license_type_id_param, 'template',
        license_price, license_price, payment_method_param, payment_reference_param
    ) RETURNING id INTO purchase_id;
    
    -- Create revenue record
    INSERT INTO sw_revenue_records (
        purchase_id, template_id, author_user_id, buyer_user_id,
        gross_amount, platform_fee_percentage, platform_fee_amount, author_earnings
    ) VALUES (
        purchase_id, template_id_param, author_id, user_id_param,
        license_price, platform_fee_pct, platform_fee, author_earnings
    );
    
    -- Update template download count
    UPDATE sw_templates 
    SET num_downloads = num_downloads + 1 
    WHERE id = template_id_param;
    
    RETURN purchase_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate template average rating
CREATE OR REPLACE FUNCTION update_template_rating(template_id_param UUID) 
RETURNS VOID AS $$
DECLARE
    avg_rating DECIMAL(3,2);
    rating_count INTEGER;
BEGIN
    -- Calculate average rating
    SELECT 
        ROUND(AVG(rating)::numeric, 2),
        COUNT(*)
    INTO avg_rating, rating_count
    FROM sw_template_ratings 
    WHERE template_id = template_id_param 
    AND is_hidden = false;
    
    -- Update template with new rating
    UPDATE sw_templates 
    SET popularity = COALESCE(avg_rating * 20, 0) -- Convert 1-5 rating to 0-100 popularity
    WHERE id = template_id_param;
    
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 8: TRIGGERS
-- ================================================================

-- Trigger to update template rating when review is added/updated
CREATE OR REPLACE FUNCTION trigger_update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_template_rating(NEW.template_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_template_rating(OLD.template_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sw_template_ratings_update_rating
    AFTER INSERT OR UPDATE OR DELETE ON sw_template_ratings
    FOR EACH ROW EXECUTE FUNCTION trigger_update_template_rating();

-- Trigger to update helpful votes count
CREATE OR REPLACE FUNCTION trigger_update_rating_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_helpful THEN
            UPDATE sw_template_ratings 
            SET helpful_votes = helpful_votes + 1 
            WHERE id = NEW.rating_id;
        ELSE
            UPDATE sw_template_ratings 
            SET not_helpful_votes = not_helpful_votes + 1 
            WHERE id = NEW.rating_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_helpful THEN
            UPDATE sw_template_ratings 
            SET helpful_votes = helpful_votes - 1 
            WHERE id = OLD.rating_id;
        ELSE
            UPDATE sw_template_ratings 
            SET not_helpful_votes = not_helpful_votes - 1 
            WHERE id = OLD.rating_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sw_rating_votes_update_count
    AFTER INSERT OR DELETE ON sw_rating_votes
    FOR EACH ROW EXECUTE FUNCTION trigger_update_rating_votes();

-- ================================================================
-- SECTION 9: ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on new tables
ALTER TABLE sw_template_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_license_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_author_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_template_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_rating_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sw_bundle_ratings ENABLE ROW LEVEL SECURITY;

-- Collection policies
CREATE POLICY "Users can manage own collections" ON sw_template_collections
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Public read access for public collections" ON sw_template_collections
    FOR SELECT USING (is_public = true);

-- Purchase policies
CREATE POLICY "Users can view own purchases" ON sw_template_purchases
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Revenue policies (admin/author only)
CREATE POLICY "Authors can view own revenue" ON sw_revenue_records
    FOR SELECT USING (auth.uid()::text = author_user_id::text);

-- Rating policies
CREATE POLICY "Users can manage own ratings" ON sw_template_ratings
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Public read access for visible ratings" ON sw_template_ratings
    FOR SELECT USING (is_hidden = false);

-- Public read access for licenses and bundles
CREATE POLICY "Public read access for license types" ON sw_license_types
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for template licenses" ON sw_template_licenses
    FOR SELECT USING (is_available = true);

CREATE POLICY "Public read access for active bundles" ON sw_template_bundles
    FOR SELECT USING (is_active = true);

COMMIT;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'sw_%'
AND table_name IN (
    'sw_template_collections',
    'sw_template_bundles', 
    'sw_template_purchases',
    'sw_template_ratings',
    'sw_revenue_records'
)
ORDER BY table_name;

-- Show license types
SELECT code, name, price_multiplier, allows_commercial_use 
FROM sw_license_types 
WHERE is_active = true 
ORDER BY sort_order;
