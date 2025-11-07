-- ========================================
-- Update Card Prices in saved_designs Table
-- ========================================

-- OPTION 1: Set price for ALL cards
UPDATE saved_designs 
SET price = 1.99 
WHERE price = 0 OR price = 2.99;

-- OPTION 2: Set specific price for a single card
UPDATE saved_designs 
SET price = 1.99 
WHERE id = 'your-card-id-here';

-- OPTION 3: Set different prices by category
UPDATE saved_designs 
SET price = 1.49 
WHERE category = 'Birthday';

UPDATE saved_designs 
SET price = 2.49 
WHERE category = 'Wedding';

UPDATE saved_designs 
SET price = 0.99 
WHERE category = 'Thank You';

-- OPTION 4: Set price for all user-created cards
UPDATE saved_designs 
SET price = 1.99 
WHERE status IN ('draft', 'published');

-- OPTION 5: Set price for template-based cards
UPDATE saved_designs 
SET price = 2.49 
WHERE template_id IS NOT NULL;

-- ========================================
-- Verify the updates
-- ========================================

-- Check all prices
SELECT 
  id, 
  title, 
  category, 
  price, 
  status,
  created_at 
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 20;

-- Check price distribution
SELECT 
  price, 
  COUNT(*) as card_count 
FROM saved_designs 
GROUP BY price 
ORDER BY price;

-- ========================================
-- IMPORTANT NOTES:
-- ========================================
-- 1. The 'saved_designs' table stores card prices
-- 2. The 'orders' table stores order history (not prices)
-- 3. When you update saved_designs.price, 
--    it will show immediately in the payment modal
-- 4. Prices are in USD (decimal)
-- 5. Processing fee is automatically added (5%)


