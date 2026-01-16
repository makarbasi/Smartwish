# ✅ Complete Supabase Setup - Step by Step

## Step 1: Get Your Supabase Credentials (2 minutes)

### 1a. Go to Supabase Dashboard
Visit: https://app.supabase.com

### 1b. Select Your Project
- If you don't have a project, create one (free tier is fine)
- Click on your project

### 1c. Get API Keys
1. In left sidebar, click **Settings** (gear icon at bottom)
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL** - Copy this
   - **anon public** key - Copy this  
   - **service_role** key - Copy this (⚠️ Keep secret!)

---

## Step 2: Add to .env.local (1 minute)

Open or create: `smartwish-frontend/.env.local`

Add these lines (replace with your actual values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi...

# Stripe Keys (Already configured)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key-here
STRIPE_SECRET_KEY=sk_live_your-secret-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ IMPORTANT:**
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret
- Never commit `.env.local` to Git
- Each key should be on ONE line (no line breaks)

---

## Step 3: Run Database Migration (2 minutes)

### 3a. Go to Supabase SQL Editor
1. In Supabase Dashboard, click **SQL Editor** in left sidebar
2. Click **New query** button

### 3b. Copy Migration SQL
You already have the file open: `001_create_payment_system.sql`

1. Press **Ctrl+A** to select all
2. Press **Ctrl+C** to copy

### 3c. Run Migration
1. Paste into Supabase SQL Editor (**Ctrl+V**)
2. Click **RUN** button (bottom right)
3. Wait for it to complete (5-10 seconds)

### 3d. Verify Success
You should see: "Success. No rows returned"

If you see any errors, tell me what they say!

---

## Step 4: Verify Tables Were Created (1 minute)

In Supabase Dashboard:

1. Click **Table Editor** in left sidebar
2. You should see these new tables:
   - ✅ `orders`
   - ✅ `payment_sessions`
   - ✅ `transactions`

Click on each one to see the columns.

---

## Step 5: Restart Development Server (30 seconds)

In your terminal:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

Wait for it to say "Ready" or "Compiled successfully"

---

## Step 6: Test the Complete System (2 minutes)

### 6a. Update Template Prices (if needed)
In Supabase SQL Editor, run:

```sql
-- Set template prices
UPDATE sw_templates SET price = 0.01;

-- Verify
SELECT id, title, price FROM sw_templates LIMIT 10;
```

### 6b. Clear Old Test Cards
```sql
-- Delete old test cards
DELETE FROM saved_designs WHERE price = 0 OR price = 2.99;
```

### 6c. Add Template Fresh
1. Go to `http://localhost:3000/templates`
2. Add a template to "My Cards"
3. Go to `http://localhost:3000/my-cards`
4. Click **"Send E-Card"** or **"Print"**

### 6d. Check Payment Modal
You should see:
- ✅ Price from template (e.g., $0.01)
- ✅ Processing fee (5%)
- ✅ Total calculated correctly
- ✅ QR code for mobile payment
- ✅ Card input form

---

## Step 7: Verify in Database

After opening the payment modal, check Supabase:

```sql
-- Check if order was created
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Check if payment session was created
SELECT * FROM payment_sessions ORDER BY created_at DESC LIMIT 1;
```

You should see your order with the correct price!

---

## 🎯 Complete Checklist

- [ ] 1. Got Supabase credentials from dashboard
- [ ] 2. Added all 3 env vars to `.env.local`
- [ ] 3. Ran migration in SQL Editor
- [ ] 4. Verified 3 tables created
- [ ] 5. Restarted dev server
- [ ] 6. Updated template prices in database
- [ ] 7. Deleted old test cards
- [ ] 8. Added template fresh (after restart)
- [ ] 9. Tested payment modal
- [ ] 10. Verified order in database

---

## 🐛 If You Get Errors

### Error: "Missing Supabase environment variables"
- Check `.env.local` exists in `smartwish-frontend/` folder
- Check no typos in variable names
- Check keys are on single lines (no breaks)
- Restart server after adding env vars

### Error: "relation 'orders' does not exist"
- Migration didn't run successfully
- Go back to Step 3 and run migration again
- Check for any SQL errors

### Error: "Failed to create order"
- Check server terminal logs for more details
- Might be RLS (Row Level Security) issue
- Try refreshing Supabase dashboard

---

## 🎉 Success!

Once working, you'll have:
- ✅ Complete order tracking
- ✅ Payment session management
- ✅ Transaction history
- ✅ Cross-device QR payments
- ✅ Proper price handling
- ✅ Production-ready system

---

**Start with Step 1 and go through each step!**

Tell me when you're done or if you hit any errors!


