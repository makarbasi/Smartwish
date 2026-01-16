# 🗄️ Run Payment System Migration

## Step 1: Go to Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)

## Step 2: Run the Migration

1. Click **"New Query"**
2. Copy the ENTIRE contents of `supabase/migrations/001_create_payment_system.sql`
3. Paste into the SQL editor
4. Click **"Run"** or press `Ctrl+Enter`

## Step 3: Verify Tables Created

Run this query to check:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'payment_sessions', 'transactions')
ORDER BY table_name;
```

You should see:
- `orders`
- `payment_sessions`
- `transactions`

## Step 4: Test the System

1. Restart your backend:
   ```bash
   cd smartwish-backend/backend
   npm run start:dev
   ```

2. Try to make a payment
3. Check the database:

```sql
-- See all orders
SELECT id, user_id, card_name, total_amount, status, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- See all payment sessions
SELECT id, order_id, amount, status, created_at 
FROM payment_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- See all transactions
SELECT id, order_id, amount, status, stripe_payment_intent_id, created_at 
FROM transactions 
ORDER BY created_at DESC 
LIMIT 10;
```

## ✅ Done!

Your payment system now has proper database tracking for:
- **Orders** - What was purchased
- **Payment Sessions** - Real-time payment status
- **Transactions** - Completed payments with Stripe details

