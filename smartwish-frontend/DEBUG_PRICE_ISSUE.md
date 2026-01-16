# 🐛 Debug Price Issue

## Problem
Prices in database are updated, but payment modal still shows $2.99

## Root Cause
The API has fallback to 2.99 in multiple places:

```typescript
// Line 25: Initial fallback
let cardPrice = 2.99 // Default price if we can't fetch from database

// Line 46: Fallback if price is null/0
cardPrice = parseFloat(cardData.price || 2.99)

// Line 122: Error handler fallback
const defaultPrice = 2.99
```

## Possible Issues

### Issue 1: Backend API Not Returning Price
**Symptom:** `cardData.price` is `null`, `0`, or `undefined`

**Check:**
```sql
-- In Supabase, check your card prices:
SELECT id, title, price FROM saved_designs LIMIT 10;
```

If prices show as `0` or `NULL`, update them:
```sql
UPDATE saved_designs SET price = 1.99 WHERE price = 0 OR price IS NULL;
```

### Issue 2: Backend API Call Failing
**Symptom:** Fetch to `/api/saved-designs/{cardId}` returns 404 or error

**Check browser console for:**
- ❌ `Card not found in database, using default price`
- ❌ `Error fetching card:`

### Issue 3: Authorization Header Missing
**Symptom:** Backend requires auth but frontend doesn't send token

**Check:**
The API tries to pass authorization:
```typescript
headers: {
  'Authorization': request.headers.get('authorization') || '',
}
```

But if you're not logged in, this might fail.

## 🔍 How to Debug

### Step 1: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for `💰` emoji logs
4. You should see:
   ```
   💰 Calculate Price - Request: {cardId: "xxx", ...}
   💰 Backend URL: http://localhost:3001
   💰 Fetching card from: http://localhost:3001/api/saved-designs/xxx
   💰 Card fetch response status: 200
   💰 Card data received: {id: "xxx", title: "...", price: "1.99"}
   💰 Price Calculation Result: {cardPrice: "1.99", ...}
   ```

### Step 2: Check Network Tab
1. DevTools → Network tab
2. Filter: `calculate-price`
3. Click the request
4. Check Response:
   ```json
   {
     "success": true,
     "cardPrice": 1.99,   ← Should show your new price!
     "total": 2.09
   }
   ```

### Step 3: Test Backend API Directly
```bash
# Test if backend returns correct price:
curl http://localhost:3001/api/saved-designs/YOUR-CARD-ID
```

Should return:
```json
{
  "id": "xxx",
  "title": "Birthday Card",
  "price": "1.99",   ← Check this value!
  ...
}
```

## ✅ Solutions

### Solution 1: Update Database (if prices are 0 or NULL)
```sql
-- Set all cards to $1.99
UPDATE saved_designs SET price = 1.99;

-- Or set specific card
UPDATE saved_designs SET price = 1.99 WHERE id = 'your-card-id';

-- Verify
SELECT id, title, price FROM saved_designs WHERE price > 0;
```

### Solution 2: Remove Fallback (if database prices are correct)
If your database has correct prices but the fallback is always triggered, we need to update the API logic.

I'll create a fixed version that logs more details.

### Solution 3: Check Backend is Running
```bash
# Make sure backend is running on port 3001
curl http://localhost:3001/api/saved-designs
```

If this fails, backend is not running or wrong port.

## 🧪 Quick Test

Run this to test a specific card:
```bash
# Replace YOUR-CARD-ID with actual card ID
curl -X POST http://localhost:3000/api/cards/calculate-price \
  -H "Content-Type: application/json" \
  -d '{"cardId":"YOUR-CARD-ID"}'
```

Should return:
```json
{
  "success": true,
  "cardPrice": 1.99,  ← Your actual price!
  "giftCardAmount": 0,
  "processingFee": 0.10,
  "total": 2.09
}
```

If it returns 2.99, then:
1. Backend is not returning price
2. Or price is 0/null in database

## 🔧 What to Check Right Now

1. **Open browser DevTools** (F12)
2. **Try to pay for a card**
3. **Check Console** for `💰` logs
4. **Copy and send me the logs** - I'll tell you exactly what's wrong!

The logs will show:
- ✅ If backend is being called
- ✅ If price is being returned
- ✅ What price value is received
- ✅ What's causing the fallback to 2.99


