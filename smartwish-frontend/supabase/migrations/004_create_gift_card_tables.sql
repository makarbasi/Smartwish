-- =====================================================
-- SmartWish Internal Gift Card System
-- Database migration for gift_card_brands, gift_cards, and gift_card_transactions
-- =====================================================

-- ==================== GIFT CARD BRANDS TABLE ====================
-- Stores gift card product definitions created by admins
CREATE TABLE IF NOT EXISTS gift_card_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT NOT NULL,
    
    -- Amount limits
    min_amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    max_amount DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    min_redemption_amount DECIMAL(10,2) DEFAULT 0.01,
    
    -- Expiration
    expiry_months INTEGER NOT NULL DEFAULT 12,
    
    -- Flags
    is_smartwish_brand BOOLEAN DEFAULT false,  -- Can be used to pay for greeting cards/stickers
    is_promoted BOOLEAN DEFAULT false,         -- Show in promoted section
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== GIFT CARDS TABLE ====================
-- Stores individual issued gift card instances
CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES gift_card_brands(id) ON DELETE RESTRICT,
    
    -- Card identification
    card_number VARCHAR(20) UNIQUE NOT NULL,   -- 16-digit display number (SW + 14 chars)
    card_code VARCHAR(64) UNIQUE NOT NULL,     -- Full code for QR lookup (UUID)
    pin_hash VARCHAR(100) NOT NULL,            -- bcrypt hashed 4-digit PIN
    
    -- Balance tracking
    initial_balance DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    
    -- Status management
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'depleted', 'expired', 'voided', 'suspended')
    ),
    
    -- Lifecycle timestamps
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,                  -- First redemption timestamp
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Purchase information
    purchased_by UUID REFERENCES auth.users(id),
    purchase_order_id VARCHAR(100),            -- Stripe payment intent ID
    kiosk_id UUID,                             -- Which kiosk issued the card
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== GIFT CARD TRANSACTIONS TABLE ====================
-- Audit trail for all gift card operations
CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE RESTRICT,
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL CHECK (
        transaction_type IN ('purchase', 'redemption', 'void', 'adjustment', 'refund')
    ),
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    
    -- Context
    description TEXT,
    performed_by UUID REFERENCES auth.users(id),
    kiosk_id UUID,
    reference_id VARCHAR(100),                 -- External reference (order ID, etc.)
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== GIFT CARD BALANCE CHECK ATTEMPTS TABLE ====================
-- Rate limiting for balance check attempts (security)
CREATE TABLE IF NOT EXISTS gift_card_balance_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    ip_address INET,
    success BOOLEAN NOT NULL DEFAULT false,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEXES ====================

-- Gift card brands indexes
CREATE INDEX IF NOT EXISTS idx_gift_card_brands_slug ON gift_card_brands(slug);
CREATE INDEX IF NOT EXISTS idx_gift_card_brands_active ON gift_card_brands(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gift_card_brands_promoted ON gift_card_brands(is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_gift_card_brands_smartwish ON gift_card_brands(is_smartwish_brand) WHERE is_smartwish_brand = true;
CREATE INDEX IF NOT EXISTS idx_gift_card_brands_created_by ON gift_card_brands(created_by);

-- Gift cards indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_brand_id ON gift_cards(brand_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_card_number ON gift_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_gift_cards_card_code ON gift_cards(card_code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchased_by ON gift_cards(purchased_by);
CREATE INDEX IF NOT EXISTS idx_gift_cards_kiosk_id ON gift_cards(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_expires_at ON gift_cards(expires_at);
CREATE INDEX IF NOT EXISTS idx_gift_cards_issued_at ON gift_cards(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchase_order ON gift_cards(purchase_order_id);

-- Gift card transactions indexes
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_type ON gift_card_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_performed_by ON gift_card_transactions(performed_by);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_kiosk_id ON gift_card_transactions(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_created_at ON gift_card_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_reference ON gift_card_transactions(reference_id);

-- Balance attempts indexes (for rate limiting queries)
CREATE INDEX IF NOT EXISTS idx_gift_card_balance_attempts_card_id ON gift_card_balance_attempts(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_balance_attempts_time ON gift_card_balance_attempts(gift_card_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_card_balance_attempts_ip ON gift_card_balance_attempts(ip_address, attempted_at DESC);

-- ==================== FUNCTIONS & TRIGGERS ====================

-- Function to update updated_at timestamp for gift_card_brands
CREATE OR REPLACE FUNCTION update_gift_card_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp for gift_cards
CREATE OR REPLACE FUNCTION update_gift_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_gift_card_brands_updated_at ON gift_card_brands;
CREATE TRIGGER trigger_gift_card_brands_updated_at
    BEFORE UPDATE ON gift_card_brands
    FOR EACH ROW
    EXECUTE FUNCTION update_gift_card_brands_updated_at();

DROP TRIGGER IF EXISTS trigger_gift_cards_updated_at ON gift_cards;
CREATE TRIGGER trigger_gift_cards_updated_at
    BEFORE UPDATE ON gift_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_gift_cards_updated_at();

-- Function to auto-update card status to 'depleted' when balance reaches zero
CREATE OR REPLACE FUNCTION check_gift_card_depleted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_balance <= 0 AND OLD.current_balance > 0 THEN
        NEW.status = 'depleted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gift_card_depleted ON gift_cards;
CREATE TRIGGER trigger_gift_card_depleted
    BEFORE UPDATE ON gift_cards
    FOR EACH ROW
    WHEN (NEW.current_balance <= 0 AND OLD.current_balance > 0)
    EXECUTE FUNCTION check_gift_card_depleted();

-- Function to record first redemption (activation)
CREATE OR REPLACE FUNCTION set_gift_card_activated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'redemption' THEN
        UPDATE gift_cards
        SET activated_at = NOW()
        WHERE id = NEW.gift_card_id
        AND activated_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gift_card_activated ON gift_card_transactions;
CREATE TRIGGER trigger_gift_card_activated
    AFTER INSERT ON gift_card_transactions
    FOR EACH ROW
    WHEN (NEW.transaction_type = 'redemption')
    EXECUTE FUNCTION set_gift_card_activated();

-- Function to check balance attempt rate limiting (max 5 attempts per card per hour)
CREATE OR REPLACE FUNCTION check_balance_rate_limit(p_card_id UUID, p_ip_address INET DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO attempt_count
    FROM gift_card_balance_attempts
    WHERE gift_card_id = p_card_id
    AND attempted_at > NOW() - INTERVAL '1 hour';
    
    RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old balance attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_balance_attempts()
RETURNS void AS $$
BEGIN
    DELETE FROM gift_card_balance_attempts
    WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to expire gift cards that have passed their expiry date
CREATE OR REPLACE FUNCTION expire_gift_cards()
RETURNS void AS $$
BEGIN
    UPDATE gift_cards
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS
ALTER TABLE gift_card_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_balance_attempts ENABLE ROW LEVEL SECURITY;

-- Gift card brands policies

-- Anyone can view active brands (for marketplace)
CREATE POLICY "Allow read active gift card brands" ON gift_card_brands
    FOR SELECT
    USING (is_active = true);

-- Allow admins full access (handled via service role in API)
CREATE POLICY "Allow admin full access to gift card brands" ON gift_card_brands
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Gift cards policies

-- Users can view their own purchased cards
CREATE POLICY "Users can view their own gift cards" ON gift_cards
    FOR SELECT
    USING (auth.uid() = purchased_by);

-- Allow insert via service role (API handles authorization)
CREATE POLICY "Allow insert gift cards" ON gift_cards
    FOR INSERT
    WITH CHECK (true);

-- Allow update via service role (API handles authorization)
CREATE POLICY "Allow update gift cards" ON gift_cards
    FOR UPDATE
    USING (true);

-- Service role can read all cards (for manager redemption)
CREATE POLICY "Service role can read all gift cards" ON gift_cards
    FOR SELECT
    USING (true);

-- Gift card transactions policies

-- Users can view transactions for their own cards
CREATE POLICY "Users can view their own card transactions" ON gift_card_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM gift_cards
            WHERE gift_cards.id = gift_card_transactions.gift_card_id
            AND gift_cards.purchased_by = auth.uid()
        )
    );

-- Allow insert via service role
CREATE POLICY "Allow insert gift card transactions" ON gift_card_transactions
    FOR INSERT
    WITH CHECK (true);

-- Service role can read all transactions
CREATE POLICY "Service role can read all transactions" ON gift_card_transactions
    FOR SELECT
    USING (true);

-- Balance attempts policies (insert only, read by service role)
CREATE POLICY "Allow insert balance attempts" ON gift_card_balance_attempts
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can read balance attempts" ON gift_card_balance_attempts
    FOR SELECT
    USING (true);

CREATE POLICY "Service role can delete balance attempts" ON gift_card_balance_attempts
    FOR DELETE
    USING (true);

-- ==================== HELPER VIEWS ====================

-- View for gift card summary with brand info
CREATE OR REPLACE VIEW gift_card_summary AS
SELECT 
    gc.id,
    gc.card_number,
    gc.status,
    gc.initial_balance,
    gc.current_balance,
    gc.issued_at,
    gc.activated_at,
    gc.expires_at,
    gc.purchased_by,
    gc.kiosk_id,
    gcb.id as brand_id,
    gcb.name as brand_name,
    gcb.slug as brand_slug,
    gcb.logo_url as brand_logo_url,
    gcb.is_smartwish_brand,
    (SELECT COUNT(*) FROM gift_card_transactions gct WHERE gct.gift_card_id = gc.id) as transaction_count,
    (SELECT SUM(amount) FROM gift_card_transactions gct WHERE gct.gift_card_id = gc.id AND gct.transaction_type = 'redemption') as total_redeemed
FROM gift_cards gc
JOIN gift_card_brands gcb ON gc.brand_id = gcb.id;

-- View for brand statistics
CREATE OR REPLACE VIEW gift_card_brand_stats AS
SELECT 
    gcb.id,
    gcb.name,
    gcb.slug,
    gcb.logo_url,
    gcb.is_active,
    gcb.is_promoted,
    gcb.is_smartwish_brand,
    COUNT(gc.id) as total_cards_issued,
    COUNT(CASE WHEN gc.status = 'active' THEN 1 END) as active_cards,
    COUNT(CASE WHEN gc.status = 'depleted' THEN 1 END) as depleted_cards,
    COUNT(CASE WHEN gc.status = 'expired' THEN 1 END) as expired_cards,
    COALESCE(SUM(gc.initial_balance), 0) as total_value_issued,
    COALESCE(SUM(gc.current_balance), 0) as outstanding_balance,
    COALESCE(SUM(gc.initial_balance - gc.current_balance), 0) as total_redeemed
FROM gift_card_brands gcb
LEFT JOIN gift_cards gc ON gcb.id = gc.brand_id
GROUP BY gcb.id, gcb.name, gcb.slug, gcb.logo_url, gcb.is_active, gcb.is_promoted, gcb.is_smartwish_brand;

-- ==================== COMMENTS ====================

COMMENT ON TABLE gift_card_brands IS 'Gift card product definitions created by admins';
COMMENT ON TABLE gift_cards IS 'Individual issued gift card instances with balance tracking';
COMMENT ON TABLE gift_card_transactions IS 'Audit trail for all gift card operations (purchases, redemptions, etc.)';
COMMENT ON TABLE gift_card_balance_attempts IS 'Rate limiting table for balance check attempts';

COMMENT ON COLUMN gift_card_brands.is_smartwish_brand IS 'If true, card balance can be used to pay for greeting cards and stickers';
COMMENT ON COLUMN gift_card_brands.is_promoted IS 'If true, brand appears in promoted/featured section of marketplace';
COMMENT ON COLUMN gift_card_brands.expiry_months IS 'Number of months until gift cards of this brand expire after purchase';

COMMENT ON COLUMN gift_cards.card_number IS '16-character display number in format SW + 14 alphanumeric chars';
COMMENT ON COLUMN gift_cards.card_code IS 'UUID used for QR code lookup (more secure than card_number)';
COMMENT ON COLUMN gift_cards.pin_hash IS 'bcrypt hashed 4-digit PIN required for redemption';
COMMENT ON COLUMN gift_cards.status IS 'Card lifecycle: active → depleted/expired/voided/suspended';
COMMENT ON COLUMN gift_cards.activated_at IS 'Timestamp of first redemption (NULL if never used)';

COMMENT ON COLUMN gift_card_transactions.transaction_type IS 'Type: purchase (initial), redemption (use), void (cancel), adjustment (admin), refund';
COMMENT ON COLUMN gift_card_transactions.balance_before IS 'Card balance before this transaction';
COMMENT ON COLUMN gift_card_transactions.balance_after IS 'Card balance after this transaction';

COMMENT ON VIEW gift_card_summary IS 'Summary view of gift cards with brand information';
COMMENT ON VIEW gift_card_brand_stats IS 'Aggregate statistics for each gift card brand';

COMMENT ON FUNCTION check_balance_rate_limit IS 'Returns true if card has fewer than 5 balance check attempts in the last hour';
COMMENT ON FUNCTION cleanup_old_balance_attempts IS 'Removes balance attempt records older than 24 hours';
COMMENT ON FUNCTION expire_gift_cards IS 'Updates status to expired for cards past their expiry date';
