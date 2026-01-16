-- Check if the card exists and who owns it
SELECT 
  id,
  title,
  price,
  author_id,
  created_at,
  status
FROM saved_designs 
WHERE id = '5ebb0c5f-bc91-4e76-ae21-5156c2556f96';

-- If no results, the card doesn't exist!
-- If results show, check the author_id

-- Also check all your recent cards
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

-- Check if there are ANY cards with that price
SELECT COUNT(*) as total_cards_01_cents
FROM saved_designs 
WHERE price = 0.01;

-- Check templates
SELECT COUNT(*) as total_templates_01_cents
FROM sw_templates 
WHERE price = 0.01;


