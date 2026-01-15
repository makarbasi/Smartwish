-- Migration: Kiosk gift card analytics view
-- Gift card purchase info (kiosk, discount, etc.) is stored on ORDERS, not gift_cards
-- This view joins through orders to get analytics

-- Drop old view if exists (from previous version)
DROP VIEW IF EXISTS kiosk_gift_card_stats;

-- Create analytics view that joins gift_cards → orders → kiosk info
-- Orders store: metadata.kioskId, metadata.discountPercent, metadata.productType
CREATE VIEW kiosk_gift_card_stats AS
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

-- Note: To get full kiosk info (name, store_id), join this view with kiosk_configs:
-- SELECT s.*, k.name, k.store_id 
-- FROM kiosk_gift_card_stats s
-- LEFT JOIN kiosk_configs k ON s.kiosk_id = k.kiosk_id
