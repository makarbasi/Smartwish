# 🔧 Quick Fix: Test Price Without Database Setup

## Problem
You want to test if the price fix works, but you're getting:
```
❌ Failed to create order
```

This is because the new payment system needs Supabase database setup.

## Quick Solution: Temporarily Disable Database Order Creation

We can make the payment modal work WITHOUT creating orders in database (just for testing).

### Option 1: Use Old CardPaymentModal (Simpler)

The old `my-cards` page doesn't use the database-backed payment modal yet!

**Test there:**
1. Go to `/my-cards`
2. Try "Send E-Card" or "Print"
3. That should show the price correctly WITHOUT needing database

### Option 2: Make Payment Modal Skip Order Creation (Quick Hack)

Edit `CardPaymentModal.tsx` temporarily:

**Line 196-223:** Comment out order creation:

```typescript
// Step 3: Create order in database
console.log('📦 Skipping order creation for testing...')
const fakeOrderId = `test-order-${Date.now()}`
setOrderId(fakeOrderId)
console.log('✅ Using fake order:', fakeOrderId)

/*
// COMMENTED OUT FOR TESTING:
const orderResponse = await fetch('/api/orders/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    cardId,
    cardName,
    orderType: action === 'send' ? 'send_ecard' : 'print',
    recipientEmail,
    cardPrice: priceResult.cardPrice,
    giftCardAmount: priceResult.giftCardAmount,
    processingFee: priceResult.processingFee,
    totalAmount: priceResult.total,
    giftCardProductName,
    giftCardRedemptionLink,
    metadata: { action }
  })
})

if (!orderResponse.ok) {
  throw new Error('Failed to create order')
}

const { order } = await orderResponse.json()
setOrderId(order.id)
console.log('✅ Order created:', order.id)
*/
```

Then you can test the price without setting up database!

---

## OR: Full Database Setup (Production)

If you want the full system working:

### Step 1: Add Supabase Environment Variables

Create/edit `.env.local`:

```env
# Supabase (Get from https://app.supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (Already set)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

### Step 2: Run Database Migration

1. Go to https://app.supabase.com
2. Open your project
3. Go to **SQL Editor**
4. Copy contents of `smartwish-frontend/supabase/migrations/001_create_payment_system.sql`
5. Paste and click **RUN**

This creates the `orders`, `payment_sessions`, and `transactions` tables.

### Step 3: Restart Server

```bash
npm run dev
```

---

## 🎯 Recommendation

**For NOW (to test price fix):**
1. Test on `/my-cards` page
2. OR temporarily comment out order creation
3. Just verify the PRICE shows correctly

**For LATER (production):**
1. Set up Supabase properly
2. Run the migration
3. Full system with order tracking

---

## Quick Test Without Database

1. Go to `/my-cards`
2. Find a card
3. Click "Send E-Card"
4. Does it show correct price?

If YES → Price fix works! ✅  
If NO → Different issue

Let me know what you see!


