# 🔧 Setup Payment Tables - Step by Step

## Step 1: Check if Tables Exist

Run this SQL in your Supabase SQL Editor:

```sql
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payment_sessions', 'transactions')
ORDER BY table_name;
```

### Expected Results:

**✅ If you see 3 rows** (orders, payment_sessions, transactions):
- Tables exist! Skip to Step 3 (Recovery)

**❌ If you see 0 rows** or less than 3:
- Tables DON'T exist! Go to Step 2 (Create Tables)

---

## Step 2: Create Payment Tables (If They Don't Exist)

### Option A: Using Supabase Dashboard (RECOMMENDED)

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the ENTIRE contents of:
   ```
   supabase/migrations/001_create_payment_system.sql
   ```
5. Paste into SQL Editor
6. Click **Run**
7. Should see: "Success. No rows returned"

### Option B: Using Supabase CLI

```bash
cd smartwish-frontend
supabase db push
```

### Verify Tables Were Created

Run the check SQL again:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payment_sessions', 'transactions');
```

Should now see **3 rows**! ✅

---

## Step 3: Recover Your Payment

Now that tables exist, run the recovery script:

**File**: `PAYMENT_RECOVERY_SQL.sql`

1. Open Supabase SQL Editor
2. Copy contents of `PAYMENT_RECOVERY_SQL.sql`
3. Paste and Run
4. Should see success messages for:
   - ✅ Payment session updated
   - ✅ Transaction created
   - ✅ Order marked as paid

---

## Step 4: Verify Recovery

Run this to confirm everything was recorded:

```sql
-- Check your recovered payment
SELECT 
  'Order' as type,
  id,
  status,
  total_amount,
  created_at
FROM orders
WHERE id = '0cd40e84-d3a1-4516-91d4-5db2e1562d02'

UNION ALL

SELECT 
  'Transaction' as type,
  id,
  status,
  amount,
  created_at
FROM transactions
WHERE stripe_payment_intent_id = 'pi_3SQZCjP3HzX85FPE11EkdtWr';
```

**Expected**: 2 rows (1 order, 1 transaction) ✅

---

## Troubleshooting

### Error: "relation orders does not exist"
**Solution**: Tables not created. Go to Step 2.

### Error: "duplicate key value violates unique constraint"
**Solution**: Payment already recovered! Check with Step 4 query.

### Error: "syntax error near..."
**Solution**: Make sure you copied the ENTIRE SQL file, not just part of it.

---

## Quick Reference

**Check Tables**: `CHECK_PAYMENT_TABLES.sql`  
**Create Tables**: `supabase/migrations/001_create_payment_system.sql`  
**Recover Payment**: `PAYMENT_RECOVERY_SQL.sql`  

---

## What Each Table Does

- **orders**: Main order records ($0.53 payment is here)
- **payment_sessions**: Real-time payment tracking (QR code sessions)
- **transactions**: Stripe transaction records (links to Stripe Payment Intent)

---

**Need Help?** Share the output of the "Check if Tables Exist" query!

