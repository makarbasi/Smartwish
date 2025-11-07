-- ========================================
-- STEP 1: Check what prices you currently have
-- ========================================
SELECT 
  id, 
  title, 
  price,
  created_at
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 20;

-- ========================================
-- STEP 2: Update all prices to $1.99
-- ========================================
UPDATE saved_designs 
SET price = 1.99;

-- ========================================
-- STEP 3: Verify the prices were updated
-- ========================================
SELECT 
  price, 
  COUNT(*) as number_of_cards 
FROM saved_designs 
GROUP BY price 
ORDER BY price;

-- You should see:
-- price | number_of_cards
-- ------+----------------
--  1.99 |             XX

-- ========================================
-- OPTIONAL: Set different prices by category
-- ========================================

-- Birthday cards = $1.49
-- UPDATE saved_designs 
-- SET price = 1.49 
-- WHERE category = 'Birthday';

-- Wedding cards = $2.49
-- UPDATE saved_designs 
-- SET price = 2.49 
-- WHERE category = 'Wedding';

-- ========================================
-- After updating, refresh your browser!
-- ========================================


