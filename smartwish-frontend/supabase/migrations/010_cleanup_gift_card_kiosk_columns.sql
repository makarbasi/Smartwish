-- Migration: Cleanup - Remove unnecessary columns from gift_cards
-- The kiosk info is stored on ORDERS (via purchase_order_id), not on gift_cards

-- Drop the old view first (depends on columns we're removing)
DROP VIEW IF EXISTS kiosk_gift_card_stats;

-- Remove the unnecessary columns added in 009
-- These are now stored on the ORDER instead
ALTER TABLE gift_cards 
DROP COLUMN IF EXISTS discount_percent,
DROP COLUMN IF EXISTS original_amount,
DROP COLUMN IF EXISTS charge_amount;

-- Note: We're NOT dropping kiosk_id column from gift_cards because it was 
-- created in an earlier migration (004) and may have existing data.
-- The backend entity no longer uses it, but keeping the column is safe.

-- Create the new analytics view that joins through orders
CREATE OR REPLACE VIEW kiosk_gift_card_stats AS
SELECT 
    o.metadata->>'kioskId' as kiosk_id,
    COUNT(gc.id) as total_cards_sold,
    COALESCE(SUM(gc.initial_balance), 0) as total_face_value,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    MAX(gc.created_at) as last_sale_at
FROM gift_cards gc
LEFT JOIN orders o ON gc.purchase_order_id = o.id::text
WHERE o.metadata->>'productType' = 'kiosk-gift-card'
GROUP BY o.metadata->>'kioskId';

-- Grant access to the view
GRANT SELECT ON kiosk_gift_card_stats TO authenticated;
