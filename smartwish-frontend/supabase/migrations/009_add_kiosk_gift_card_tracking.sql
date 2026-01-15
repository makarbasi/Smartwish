-- Migration: Add kiosk tracking columns to gift cards
-- This allows tracking gift card purchases made through kiosk gift card tiles
-- Note: gift_cards.kiosk_id is UUID but kiosk_configs.kiosk_id is TEXT
-- We skip the FK constraint due to type mismatch

-- Add new tracking columns to gift_cards table
-- (kiosk_id column already exists from 004 migration)
ALTER TABLE gift_cards
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS charge_amount DECIMAL(10,2);

-- Add comments to explain the columns
COMMENT ON COLUMN gift_cards.discount_percent IS 'Discount percentage applied at purchase (kiosk-specific promotions)';
COMMENT ON COLUMN gift_cards.original_amount IS 'Original gift card face value before any discounts';
COMMENT ON COLUMN gift_cards.charge_amount IS 'Actual amount charged to customer after discounts';

-- Create a view for kiosk gift card analytics
-- Note: Using text cast on UUID to join with kiosk_configs
DROP VIEW IF EXISTS kiosk_gift_card_stats;

CREATE VIEW kiosk_gift_card_stats AS
SELECT 
    k.kiosk_id,
    k.name as kiosk_name,
    k.store_id,
    COUNT(gc.id) as total_cards_sold,
    COALESCE(SUM(gc.original_amount), 0) as total_face_value,
    COALESCE(SUM(gc.charge_amount), 0) as total_revenue,
    COALESCE(SUM(gc.original_amount - gc.charge_amount), 0) as total_discounts_given,
    COALESCE(AVG(gc.discount_percent), 0) as avg_discount_percent,
    MAX(gc.created_at) as last_sale_at
FROM kiosk_configs k
LEFT JOIN gift_cards gc ON gc.kiosk_id::text = k.kiosk_id
GROUP BY k.kiosk_id, k.name, k.store_id;

-- Grant access to the view
GRANT SELECT ON kiosk_gift_card_stats TO authenticated;
