# 🐛 Still Showing $2.99? Here's Why

## The Issue
You see $2.99 in payment modal even though template is $0.01

## Most Likely Causes

### Cause 1: ❌ Dev Server Not Restarted
**The code change requires a server restart!**

Node.js/Next.js doesn't hot-reload API route changes automatically.

**Fix:**
```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### Cause 2: ❌ Testing with OLD Card
If the card was added to "My Cards" BEFORE the fix, it still has `price = 0` in database.

**Fix:**
```sql
-- Update ALL existing cards to correct prices
UPDATE saved_designs SET price = 1.99 WHERE price = 0 OR price < 0.10;

-- Or delete old test cards and re-add them
DELETE FROM saved_designs WHERE price = 0;
```

### Cause 3: ❌ Template Has No Price
The template itself might not have a price in `sw_templates` table.

**Check:**
```sql
-- Check template prices
SELECT id, title, price FROM sw_templates LIMIT 10;
```

If templates show `0` or `NULL`, update them:
```sql
UPDATE sw_templates SET price = 1.99 WHERE price = 0 OR price IS NULL;
```

### Cause 4: ❌ Browser Cache
Old API responses might be cached.

**Fix:**
- Press **Ctrl+Shift+R** (hard refresh)
- Or clear browser cache
- Or open Incognito window

---

## 🔍 Step-by-Step Debugging

### Step 1: Verify Template Price in Database
```sql
-- Check sw_templates table
SELECT id, title, price 
FROM sw_templates 
WHERE title LIKE '%Birthday%' 
LIMIT 5;
```

**Expected:** Should see actual prices (not 0)

### Step 2: Restart Dev Server
```bash
# In terminal where server is running:
# Press Ctrl+C to stop
# Then run:
npm run dev
```

### Step 3: Add Template AGAIN (Fresh)
1. Go to Templates page
2. Find a template with price
3. Click "Add to My Cards"
4. **Important:** This creates a NEW card with the fix applied

### Step 4: Check New Card in Database
```sql
-- Check the NEWEST card
SELECT id, title, price, created_at 
FROM saved_designs 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected:** Should show template's price (e.g., 0.01 or 1.99)

### Step 5: Test Payment Modal with NEW Card
1. Go to "My Cards"
2. Find the card you JUST added
3. Click "Send E-Card" or "Print"
4. Check payment modal

**Expected:** Should show correct price!

### Step 6: Check Browser Console Logs
Open DevTools (F12) → Console tab

Look for these logs:
```
💰 Calculate Price - Request: {cardId: "xxx"}
💰 Card data received: {price: "1.99", ...}  ← Check this!
✅ Using database price: 1.99
💰 Price Calculation Result: {cardPrice: "1.99", total: "2.09"}
```

If you see:
```
⚠️ Price is null/0/missing in database, using default 2.99
```

Then the card STILL has price = 0 in database.

---

## ✅ Complete Fix Procedure

### 1️⃣ Update Template Prices (if needed)
```sql
-- Set template prices
UPDATE sw_templates SET price = 0.01 WHERE id = 'your-template-id';

-- Or set all templates to 1.99
UPDATE sw_templates SET price = 1.99 WHERE price = 0 OR price IS NULL;

-- Verify
SELECT id, title, price FROM sw_templates LIMIT 10;
```

### 2️⃣ Delete OLD Test Cards
```sql
-- Delete cards with wrong prices
DELETE FROM saved_designs WHERE price = 0 OR price = 2.99;
```

### 3️⃣ Restart Dev Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 4️⃣ Clear Browser Cache
- Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
- Or open **Incognito/Private window**

### 5️⃣ Add Template Fresh
1. Go to Templates page
2. Add template to "My Cards"
3. This creates NEW card with correct price

### 6️⃣ Test Payment
1. Go to "My Cards"
2. Click on the NEWLY added card
3. Try payment
4. Check price

---

## 🧪 Quick Test

Run this in browser console (F12):

```javascript
// Test the price API directly
fetch('/api/cards/calculate-price', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    cardId: 'YOUR-CARD-ID-HERE' // Replace with actual card ID
  })
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', data);
  if (data.cardPrice === 2.99) {
    console.error('❌ Still returning 2.99! Card has price = 0 in database');
  } else {
    console.log('✅ Price is correct:', data.cardPrice);
  }
})
```

---

## 🎯 Most Common Mistake

**Testing with a card that was added BEFORE the fix!**

The fix only affects:
- ✅ Templates added to "My Cards" AFTER the code change
- ✅ After server restart
- ❌ NOT old cards already in saved_designs

**Solution:** Delete old test cards and add templates fresh after restart.

---

## 📞 If Still Not Working

Tell me:
1. ✅ Did you restart dev server?
2. ✅ Did you add template AFTER restart?
3. ✅ Or are you testing old card?
4. Show me result of:
   ```sql
   SELECT id, title, price, created_at FROM saved_designs ORDER BY created_at DESC LIMIT 3;
   ```
5. Show me browser console logs (the 💰 emoji ones)

I'll tell you exactly what's wrong!


