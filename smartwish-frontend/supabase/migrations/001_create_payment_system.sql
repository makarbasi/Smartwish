-- =====================================================
-- Payment and Order Management System
-- Professional production-ready schema
-- =====================================================

-- 1. Orders Table - Main order records
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    card_id UUID NOT NULL,
    
    -- Order details
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('print', 'send_ecard')),
    card_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255), -- For e-cards
    
    -- Pricing breakdown
    card_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    gift_card_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    processing_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Gift card details (if attached)
    gift_card_product_name VARCHAR(255),
    gift_card_redemption_link TEXT,
    
    -- Order status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'payment_processing', 'paid', 'completed', 'failed', 'cancelled')
    ),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Payment Sessions Table - Real-time payment tracking
CREATE TABLE IF NOT EXISTS payment_sessions (
    id VARCHAR(100) PRIMARY KEY, -- PAY-xxx format
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Stripe integration
    stripe_payment_intent_id VARCHAR(255),
    stripe_client_secret VARCHAR(255),
    
    -- Session status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'expired')
    ),
    
    -- Device tracking
    initiated_from VARCHAR(20) CHECK (initiated_from IN ('kiosk', 'mobile', 'web')),
    payment_method VARCHAR(20) CHECK (payment_method IN ('card_kiosk', 'qr_mobile')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Transactions Table - Payment records
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_session_id VARCHAR(100) REFERENCES payment_sessions(id),
    user_id UUID NOT NULL,
    
    -- Transaction details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Stripe details
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')
    ),
    
    -- Payment details
    payment_method_type VARCHAR(50), -- card, etc.
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    
    -- Failure info
    failure_code VARCHAR(50),
    failure_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    succeeded_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_card_id ON orders(card_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Payment sessions indexes
CREATE INDEX IF NOT EXISTS idx_payment_sessions_order_id ON payment_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_id ON payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires_at ON payment_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_stripe_intent ON payment_sessions(stripe_payment_intent_id);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_intent ON transactions(stripe_payment_intent_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_sessions_updated_at BEFORE UPDATE ON payment_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update order status when payment completes
CREATE OR REPLACE FUNCTION update_order_on_payment_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE orders 
        SET 
            status = 'paid',
            updated_at = NOW()
        WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_on_payment 
    AFTER UPDATE ON payment_sessions
    FOR EACH ROW 
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_order_on_payment_complete();

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_payment_sessions()
RETURNS void AS $$
BEGIN
    UPDATE payment_sessions
    SET status = 'expired'
    WHERE status IN ('pending', 'processing')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view their own orders"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id);

-- Payment sessions policies
CREATE POLICY "Users can view their own payment sessions"
    ON payment_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can update payment session status" -- For webhook updates
    ON payment_sessions FOR UPDATE
    USING (true);

-- Transactions policies
CREATE POLICY "Users can view their own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for order summary with payment info
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.id,
    o.user_id,
    o.card_id,
    o.card_name,
    o.order_type,
    o.total_amount,
    o.currency,
    o.status as order_status,
    o.created_at,
    o.completed_at,
    ps.id as payment_session_id,
    ps.status as payment_status,
    ps.payment_method,
    t.stripe_payment_intent_id,
    t.status as transaction_status
FROM orders o
LEFT JOIN payment_sessions ps ON o.id = ps.order_id
LEFT JOIN transactions t ON o.id = t.order_id;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE orders IS 'Main orders table tracking print and e-card orders';
COMMENT ON TABLE payment_sessions IS 'Real-time payment session tracking for cross-device payments';
COMMENT ON TABLE transactions IS 'Financial transaction records linked to Stripe';

COMMENT ON COLUMN orders.status IS 'Order lifecycle: pending → payment_processing → paid → completed';
COMMENT ON COLUMN payment_sessions.status IS 'Payment session: pending → processing → completed/failed/expired';
COMMENT ON COLUMN transactions.status IS 'Transaction: pending → succeeded/failed/refunded';


