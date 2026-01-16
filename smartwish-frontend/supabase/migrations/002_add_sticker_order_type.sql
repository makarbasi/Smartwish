-- =====================================================
-- Add 'sticker' to order_type constraint
-- This migration allows sticker orders in the database
-- =====================================================

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

-- Add the new constraint with 'sticker' included
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check 
    CHECK (order_type IN ('print', 'send_ecard', 'sticker'));

-- Comment
COMMENT ON COLUMN orders.order_type IS 'Order type: print, send_ecard, or sticker';

