-- Check the author_id of your cards
SELECT 
  id,
  title,
  price,
  author_id,
  created_at
FROM saved_designs 
WHERE id = '046d0fca-8620-43c8-b858-7d08c0b19191';

-- Check all cards and their authors
SELECT 
  id,
  title,
  price,
  author_id,
  created_at
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check distinct author IDs
SELECT DISTINCT author_id, COUNT(*) as card_count
FROM saved_designs
GROUP BY author_id;


