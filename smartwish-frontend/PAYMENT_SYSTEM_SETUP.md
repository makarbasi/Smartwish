# 🏗️ Professional Payment System Setup Guide

## Overview

This is a production-ready payment and order management system built with:
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **Payment Processor**: Stripe
- **Architecture**: Next.js API Routes + Database-backed session management

## 📊 Database Schema

### Tables Created:
1. **`orders`** - Main order records (print/e-card requests)
2. **`payment_sessions`** - Real-time payment session tracking
3. **`transactions`** - Financial transaction records

### Features:
- ✅ Complete order history per user
- ✅ Real-time payment status tracking
- ✅ Cross-device payment synchronization
- ✅ Automatic order status updates via triggers
- ✅ Expired session cleanup
- ✅ Row-level security (RLS)
- ✅ Optimized indexes for performance

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd smartwish-frontend
npm install @supabase/supabase-js
```

### Step 2: Run Database Migration

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_create_payment_system.sql`
4. Paste and execute the SQL

This will create:
- All necessary tables
- Indexes for performance
- Triggers for automatic updates
- Row-level security policies
- Helper views and functions

### Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe Configuration (already configured)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Where to find Supabase keys:
1. Go to Supabase Dashboard > Project Settings > API
2. **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### Step 4: Restart Your Development Server

```bash
npm run dev
```

## 🔄 How It Works

### Complete Payment Flow:

#### 1. **User Initiates Action** (Send E-Card / Print)
   ```typescript
   User clicks "Send E-Card" or "Print"
   → Opens CardPaymentModal
   ```

#### 2. **Order Creation**
   ```typescript
   POST /api/orders/create
   → Creates order record in database
   → Status: 'pending'
   → Stores: cardPrice, giftCardAmount, processingFee, totalAmount
   ```

#### 3. **Payment Session Creation**
   ```typescript
   POST /api/payment-sessions/create
   → Creates payment session linked to order
   → Generates unique session ID (PAY-xxx)
   → Status: 'pending'
   ```

#### 4. **Stripe Payment Intent**
   ```typescript
   POST /api/stripe/create-payment-intent
   → Creates Stripe payment intent
   → Returns clientSecret for card processing
   ```

#### 5. **Payment Options**

   **Option A: Kiosk Card Entry**
   ```typescript
   User enters card on kiosk
   → Stripe processes payment
   → Payment succeeds
   → Updates payment_sessions.status = 'completed'
   → Creates transaction record
   → Trigger auto-updates orders.status = 'paid'
   ```

   **Option B: Mobile QR Code**
   ```typescript
   User scans QR code with phone
   → Redirects to /payment?session=PAY-xxx
   → Mobile loads payment session from database
   → User enters card on phone
   → Stripe processes payment
   → Updates database: payment_sessions.status = 'completed'
   → Kiosk polls database every 2 seconds
   → Detects 'completed' status
   → Proceeds with action
   ```

#### 6. **Transaction Recording**
   ```typescript
   POST /api/transactions/create
   → Records transaction details
   → Stores: Stripe IDs, card brand, last4 digits
   → Status: 'succeeded'
   ```

#### 7. **Order Completion**
   ```typescript
   Order status updated to 'completed'
   → Executes send/print action
   → User receives confirmation
   ```

## 📱 Cross-Device Communication

### Problem Solved:
- ❌ localStorage is device-specific
- ❌ In-memory storage resets on hot reload
- ❌ File storage is slow and unreliable

### Solution:
- ✅ **Database-backed sessions** (Supabase)
- ✅ Mobile updates → Database → Kiosk polls
- ✅ Real-time status synchronization
- ✅ Works across any devices/browsers

### Polling Mechanism:
```typescript
// Kiosk polls every 2 seconds
GET /api/payment-sessions/status?session=PAY-xxx
→ Returns current status from database
→ When status === 'completed', proceeds
```

## 🗄️ API Endpoints Reference

### Orders
- `POST /api/orders/create` - Create new order
- `GET /api/orders/history?userId=xxx` - Get user order history

### Payment Sessions
- `POST /api/payment-sessions/create` - Create payment session
- `GET /api/payment-sessions/status?session=xxx` - Check session status
- `POST /api/payment-sessions/status` - Update session status

### Transactions
- `POST /api/transactions/create` - Record transaction

### Stripe (existing)
- `POST /api/stripe/create-payment-intent`
- `POST /api/stripe/confirm-payment`
- `POST /api/stripe/webhook`

### Cards (existing)
- `POST /api/cards/calculate-price` - Calculate order total

## 🔒 Security Features

1. **Row Level Security (RLS)**: Users can only view their own orders
2. **Service Role Key**: Backend operations bypass RLS safely
3. **Stripe Integration**: Card data never touches your servers
4. **Environment Variables**: Sensitive keys stored securely
5. **Session Expiration**: Automatic cleanup after 1 hour
6. **Encrypted Communication**: HTTPS + Stripe encryption

## 📊 Database Indexes

Optimized queries for:
- User order lookups
- Payment session status checks
- Transaction searches by Stripe ID
- Order history sorting

## 🧪 Testing the System

### Test Flow 1: Kiosk Card Entry
1. Go to `/my-cards`
2. Click "Send E-Card" or "Print"
3. Payment modal appears with invoice
4. Enter test card: `4242 4242 4242 4242`
5. Expiry: Any future date
6. CVC: Any 3 digits
7. Name: Any name
8. Click "Pay"
9. Verify success and action execution

### Test Flow 2: Mobile QR Payment
1. Go to `/my-cards` on kiosk
2. Click "Send E-Card" or "Print"
3. Scan QR code with phone
4. Complete payment on phone
5. Observe kiosk modal updating automatically
6. Verify action execution

### Verify in Database:
```sql
-- Check orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- Check payment sessions
SELECT * FROM payment_sessions ORDER BY created_at DESC LIMIT 10;

-- Check transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- Check order summary view
SELECT * FROM order_summary ORDER BY created_at DESC LIMIT 10;
```

## 🐛 Troubleshooting

### Payment session not found
- Check Supabase connection
- Verify `NEXT_PUBLIC_SUPABASE_URL` is set
- Ensure migration was run successfully

### Kiosk not detecting mobile payment
- Check database: `SELECT * FROM payment_sessions WHERE id = 'PAY-xxx';`
- Verify status is 'completed'
- Check browser console for polling errors
- Ensure both devices have internet connection

### RLS errors
- Verify user is authenticated
- Check if `user_id` is stored in localStorage
- Use service role key for admin operations

### Session expired errors
- Sessions expire after 1 hour
- User needs to restart the payment flow
- Check `expires_at` timestamp in database

## 📈 Production Considerations

### Scaling
- Supabase handles millions of rows
- Indexes optimize query performance
- Consider connection pooling for high traffic

### Monitoring
- Monitor Stripe dashboard for payment metrics
- Track order completion rates
- Set up alerts for failed payments

### Backup
- Supabase provides automatic backups
- Export critical data regularly
- Store Stripe transaction IDs for reconciliation

### Webhooks
- Configure Stripe webhooks for production
- Handle async payment confirmations
- Update order status via webhooks

## 🎯 Next Steps

1. **Test thoroughly** in development
2. **Update Stripe to live mode** keys for production
3. **Configure Stripe webhooks** endpoint
4. **Set up monitoring** and alerts
5. **Test cross-device** payments extensively
6. **Deploy** with confidence! 🚀

## 💡 Tips

- Always check Supabase logs for debugging
- Use the order_summary view for reporting
- Set up email notifications for failed payments
- Implement retry logic for failed API calls
- Consider adding refund functionality
- Store receipt data for user records

## 📞 Support

If you encounter issues:
1. Check Supabase logs
2. Check Stripe dashboard
3. Review browser console errors
4. Verify environment variables
5. Check database table contents

---

**Built with ❤️ for SmartWish - A Professional Payment System**


