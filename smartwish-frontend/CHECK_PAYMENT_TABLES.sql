-- ========================================
-- CHECK IF PAYMENT TABLES EXIST
-- ========================================
-- Run this first to verify the payment system tables are created
-- ========================================

-- Check if tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payment_sessions', 'transactions')
ORDER BY table_name;

-- If you get 3 rows back, tables exist!
-- If you get 0 rows back, you need to run the migration.

-- ========================================
-- DETAILED CHECK: Show all columns for each table
-- ========================================

-- Check orders table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
ORDER BY ordinal_position;

-- Check payment_sessions table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_sessions'
ORDER BY ordinal_position;

-- Check transactions table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transactions'
ORDER BY ordinal_position;

-- ========================================
-- RESULT INTERPRETATION:
-- ========================================
-- If you see columns listed:
--   ✅ Tables exist! You can run PAYMENT_RECOVERY_SQL.sql
--
-- If you see "no rows" or empty results:
--   ❌ Tables DON'T exist! Run the migration first:
--      supabase/migrations/001_create_payment_system.sql
-- ========================================

