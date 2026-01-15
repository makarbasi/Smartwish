-- Migration: Financial Tracking & Commission System
-- Creates tables for sales representatives and earnings tracking

-- ==================== SALES REPRESENTATIVES TABLE ====================

CREATE TABLE IF NOT EXISTS sales_representatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    
    -- Link to users table for authentication
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Commission Settings
    commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for sales_representatives
CREATE INDEX IF NOT EXISTS idx_sales_reps_email ON sales_representatives(email);
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_representatives(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_active ON sales_representatives(is_active);

-- ==================== UPDATE KIOSK_CONFIGS TABLE ====================

-- Add sales representative assignment to kiosk configs
ALTER TABLE kiosk_configs 
ADD COLUMN IF NOT EXISTS sales_representative_id UUID REFERENCES sales_representatives(id) ON DELETE SET NULL;

-- Add manager commission percent (separate from the manager assignment)
ALTER TABLE kiosk_configs 
ADD COLUMN IF NOT EXISTS manager_commission_percent DECIMAL(5,2) DEFAULT 20.00;

-- Index for kiosk sales rep lookup
CREATE INDEX IF NOT EXISTS idx_kiosk_sales_rep ON kiosk_configs(sales_representative_id);

-- ==================== EARNINGS LEDGER TABLE ====================

CREATE TABLE IF NOT EXISTS earnings_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction Reference
    kiosk_id UUID NOT NULL REFERENCES kiosk_configs(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_id UUID,
    
    -- Financial Breakdown (all in dollars)
    gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    processing_fees DECIMAL(10,2) DEFAULT 0,
    state_tax DECIMAL(10,2) DEFAULT 0,
    cost_basis DECIMAL(10,2) DEFAULT 0,
    
    -- Net amount available for distribution
    net_distributable DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Commission Distributions
    smartwish_earnings DECIMAL(10,2) DEFAULT 0,
    
    manager_earnings DECIMAL(10,2) DEFAULT 0,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    manager_commission_rate DECIMAL(5,2),
    
    sales_rep_earnings DECIMAL(10,2) DEFAULT 0,
    sales_rep_id UUID REFERENCES sales_representatives(id) ON DELETE SET NULL,
    sales_rep_commission_rate DECIMAL(5,2),
    
    -- For custom gift cards - store payout tracking
    store_payout DECIMAL(10,2) DEFAULT 0,
    store_id UUID,
    
    -- Metadata
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    
    -- Timestamps
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- For gift card redemptions, link to original purchase
    related_ledger_id UUID REFERENCES earnings_ledger(id) ON DELETE SET NULL
);

-- Indexes for earnings_ledger
CREATE INDEX IF NOT EXISTS idx_earnings_kiosk ON earnings_ledger(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_earnings_manager ON earnings_ledger(manager_id);
CREATE INDEX IF NOT EXISTS idx_earnings_sales_rep ON earnings_ledger(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_earnings_type ON earnings_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_earnings_transaction ON earnings_ledger(transaction_id);

-- ==================== TRIGGER FOR UPDATED_AT ====================

CREATE OR REPLACE FUNCTION update_sales_reps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_reps_updated_at ON sales_representatives;
CREATE TRIGGER update_sales_reps_updated_at
    BEFORE UPDATE ON sales_representatives
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_reps_updated_at();
