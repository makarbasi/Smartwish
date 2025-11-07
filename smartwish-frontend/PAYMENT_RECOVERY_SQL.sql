-- ========================================
-- PAYMENT RECOVERY SQL
-- ========================================
-- Payment ID: pi_3SQZCjP3HzX85FPE11EkdtWr
-- Order ID: 0cd40e84-d3a1-4516-91d4-5db2e1562d02
-- User ID: 57e2c7ba-9f83-429b-b29c-b04468720a35
-- Amount: $0.53 USD
-- Card ID: 59d07027-36eb-44f3-9189-48acb44d6fbf
-- ========================================

-- Step 1: Verify the order exists
SELECT * FROM orders 
WHERE id = '0cd40e84-d3a1-4516-91d4-5db2e1562d02';

-- Step 2: Update payment session (fix the payment_method value)
UPDATE payment_sessions
SET 
  stripe_payment_intent_id = 'pi_3SQZCjP3HzX85FPE11EkdtWr',
  stripe_client_secret = 'pi_3SQZCjP3HzX85FPE11EkdtWr_secret_1NpJ6njty6uqKO0emmocFW5Sd',
  payment_method = 'qr_mobile', -- ✅ Fixed: was 'card_mobile' which violated constraint
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = 'PAY-1762458714293-2w9ymr4';

-- Step 3: Insert transaction record
INSERT INTO transactions (
  id,
  order_id,
  payment_session_id,
  user_id,
  amount,
  currency,
  stripe_payment_intent_id,
  stripe_charge_id,
  status,
  payment_method_type,
  card_last4,
  card_brand,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '0cd40e84-d3a1-4516-91d4-5db2e1562d02',
  'PAY-1762458714293-2w9ymr4',
  '57e2c7ba-9f83-429b-b29c-b04468720a35',
  0.53,
  'USD',
  'pi_3SQZCjP3HzX85FPE11EkdtWr',
  NULL, -- Get actual charge ID from Stripe dashboard if needed
  'succeeded',
  'card',
  NULL, -- Get from Stripe dashboard if needed
  NULL, -- Get from Stripe dashboard if needed
  jsonb_build_object(
    'source', 'manual_recovery',
    'recovered_at', NOW(),
    'original_error', 'payment_method_check_violation_and_missing_refund_columns',
    'recovered_by', 'Bug #24 & #25 fix',
    'payment_intent_id', 'pi_3SQZCjP3HzX85FPE11EkdtWr',
    'order_id', '0cd40e84-d3a1-4516-91d4-5db2e1562d02'
  ),
  NOW(),
  NOW()
);

-- Step 4: Update order status to paid
UPDATE orders
SET 
  status = 'paid',
  updated_at = NOW()
WHERE id = '0cd40e84-d3a1-4516-91d4-5db2e1562d02';

-- Step 5: Verification - Check everything was recorded
SELECT 
  'Order' as record_type,
  id,
  status,
  total_amount
FROM orders
WHERE id = '0cd40e84-d3a1-4516-91d4-5db2e1562d02'

UNION ALL

SELECT 
  'Payment Session' as record_type,
  id,
  status,
  amount
FROM payment_sessions
WHERE id = 'PAY-1762458714293-2w9ymr4'

UNION ALL

SELECT 
  'Transaction' as record_type,
  id,
  status,
  amount
FROM transactions
WHERE stripe_payment_intent_id = 'pi_3SQZCjP3HzX85FPE11EkdtWr';

-- ========================================
-- EXPECTED RESULTS AFTER RECOVERY:
-- ========================================
-- 1. Order status: 'paid'
-- 2. Payment session status: 'completed'
-- 3. Transaction status: 'succeeded'
-- 4. All records linked via IDs
-- ========================================

