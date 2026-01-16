# 🗄️ Payment Database System - Complete Setup Guide

## ✅ What's Been Implemented

### Backend (NestJS + TypeORM)
- ✅ **Order Entity** - Track all orders (e-cards, prints)
- ✅ **PaymentSession Entity** - Real-time payment tracking
- ✅ **Transaction Entity** - Payment records with Stripe details
- ✅ **OrdersService** - Business logic for orders/payments
- ✅ **OrdersController** - REST API endpoints
- ✅ **Full integration** with existing authentication

### Frontend (Next.js)
- ✅ **Create order** before payment
- ✅ **Create payment session** with Stripe
- ✅ **Save transaction** on success
- ✅ **Update order status** (pending → paid → completed)

---

## 📋 Setup Steps

### Step 1: Run Database Migration

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Copy the ENTIRE contents of:
   ```
   smartwish-frontend/supabase/migrations/001_create_payment_system.sql
   ```
5. Paste and click **"Run"**

### Step 2: Verify Tables Created

Run this query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'payment_sessions', 'transactions')
ORDER BY table_name;
```

✅ You should see 3 tables.

### Step 3: Restart Backend

```bash
cd smartwish-backend/backend
npm run start:dev
```

Look for:
```
✅ OrdersService initialized
✅ OrdersController initialized
```

### Step 4: Test Payment Flow

1. Go to "My Cards"
2. Click "E-Send" on any card
3. Enter card details and pay

### Step 5: Verify Database Records

```sql
-- See your orders
SELECT 
  id,
  card_name,
  order_type,
  total_amount,
  status,
  created_at
FROM orders 
WHERE user_id = 'YOUR-USER-ID'
ORDER BY created_at DESC;

-- See payment sessions
SELECT 
  id,
  amount,
  status,
  stripe_payment_intent_id,
  created_at
FROM payment_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- See transactions
SELECT 
  id,
  amount,
  status,
  stripe_payment_intent_id,
  card_brand,
  card_last4,
  created_at
FROM transactions 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📊 Database Schema

### Orders Table
- Tracks what was purchased
- Links to user and card
- Contains pricing breakdown
- Status: pending → payment_processing → paid → completed

### Payment Sessions Table
- Tracks active payment attempts
- Links to order and Stripe
- Used for QR code mobile payments
- Expires after 1 hour

### Transactions Table
- Records successful payments
- Contains Stripe details
- Card info (last 4, brand)
- Refund tracking

---

## 🔍 Console Logs to Watch

### When clicking "E-Send":
```
💰 Calculating price for card: <card-id>
📦 Creating order in database...
✅ Order created: <order-id>
💳 Creating Stripe payment intent...
✅ Payment intent created: <intent-id>
💳 Creating payment session in database...
✅ Payment session created: PAY-xxx
```

### When payment succeeds:
```
✅ Payment successful: pi_xxx
💾 Creating transaction record...
✅ Transaction record created
✅ Order status updated to paid
```

---

## 🚨 Troubleshooting

### "Failed to create order"
- Check backend is running
- Check JWT token is valid
- Verify tables exist in database

### "Failed to create payment session"
- Order must be created first
- Check `orderId` in logs

### "Failed to save transaction record"
- Payment still succeeds (this is a backup record)
- Check order ID in Stripe metadata

---

## 📈 View Order History

You can now query all user orders:

```sql
SELECT 
  o.id,
  o.card_name,
  o.total_amount,
  o.status,
  o.created_at,
  t.stripe_payment_intent_id,
  t.card_last4,
  t.card_brand
FROM orders o
LEFT JOIN transactions t ON t.order_id = o.id
WHERE o.user_id = 'YOUR-USER-ID'
ORDER BY o.created_at DESC;
```

---

## ✅ You Now Have

1. ✅ **Complete order tracking** - Every purchase recorded
2. ✅ **Payment audit trail** - Full Stripe details saved
3. ✅ **Customer history** - View all past orders
4. ✅ **Refund capability** - Transaction records for refunds
5. ✅ **Production ready** - Proper database architecture

**Your payment system is now professional and production-ready!** 🎉

