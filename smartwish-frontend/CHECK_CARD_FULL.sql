-- ========================================
-- STEP 1: Check if the specific card exists
-- ========================================
SELECT 
  id,
  title,
  price,
  author_id,
  created_at,
  status
FROM saved_designs 
WHERE id = '5ebb0c5f-bc91-4e76-ae21-5156c2556f96';

-- ========================================
-- STEP 2: Check your recent saved cards
-- ========================================
SELECT 
  id,
  title,
  price,
  author_id,
  created_at,
  status
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 10;

-- ========================================
-- STEP 3: Count cards with correct price
-- ========================================
SELECT COUNT(*) as total_cards_with_01_cents
FROM saved_designs 
WHERE price = 0.01;

-- ========================================
-- STEP 4: Check if ANY saved_designs exist
-- ========================================
SELECT COUNT(*) as total_saved_designs
FROM saved_designs;

-- ========================================
-- STEP 5: Show price distribution
-- ========================================
SELECT 
  price,
  COUNT(*) as count
FROM saved_designs
GROUP BY price
ORDER BY price;


