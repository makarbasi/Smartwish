-- ========================================
-- CHECK YOUR CURRENT PRICES IN DATABASE
-- ========================================

-- Run this in Supabase SQL Editor NOW!

-- Check what prices you actually have:
SELECT 
  id,
  title, 
  price,
  status,
  created_at
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 20;

-- Count how many have price = 0:
SELECT 
  CASE 
    WHEN price = 0 THEN 'Zero Price'
    WHEN price IS NULL THEN 'NULL Price'
    WHEN price > 0 THEN 'Has Price'
  END as price_status,
  COUNT(*) as count
FROM saved_designs
GROUP BY price_status;

-- Show price distribution:
SELECT 
  price,
  COUNT(*) as card_count
FROM saved_designs
GROUP BY price
ORDER BY price;

-- ========================================
-- EXPECTED RESULTS:
-- ========================================
-- If you see mostly "0" or "NULL", that's the problem!
-- Your prices ARE in the database, but they're set to 0.

-- ========================================
-- FIX: Set actual prices
-- ========================================

-- Set all cards to $1.99 (run this if prices are 0):
UPDATE saved_designs 
SET price = 1.99 
WHERE price = 0 OR price IS NULL;

-- Verify the fix:
SELECT price, COUNT(*) FROM saved_designs GROUP BY price;


