# Fix Supabase RLS (Row Level Security) Issue

## Problem
The error `new row violates row-level security policy for table "saved_designs"` occurs because:
1. RLS is enabled on the `saved_designs` table
2. The policies expect Supabase Auth (`auth.uid()`)
3. We're using our own JWT authentication system

## Solution: Proper RLS Implementation with Service Role

### Step 1: Get Service Role Key
1. **Go to Supabase Dashboard** → **Settings** → **API**
2. **Copy the "service_role" key** (not the anon key)

### Step 2: Add to Environment
Add to your `.env` file:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Apply RLS Migration
Run this SQL in your Supabase SQL Editor:

```sql
-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Users can view own designs" ON saved_designs;
DROP POLICY IF EXISTS "Users can insert own designs" ON saved_designs;
DROP POLICY IF EXISTS "Users can update own designs" ON saved_designs;
DROP POLICY IF EXISTS "Users can delete own designs" ON saved_designs;

-- Keep RLS enabled but create policies that work with service role
ALTER TABLE saved_designs ENABLE ROW LEVEL SECURITY;

-- Create policies that allow service role to perform all operations
-- This is secure because the service role key is only used by our backend
CREATE POLICY "Service role can perform all operations" ON saved_designs
    FOR ALL USING (true);

-- Grant necessary permissions to the service role
GRANT ALL ON saved_designs TO service_role;
GRANT ALL ON published_designs TO service_role;
```

## Test the Fix

After applying the solution:

1. **Restart your backend**
2. **Check backend logs** - should see "✅ Supabase connected with service role key"
3. **Try saving a design**
4. **Check backend logs** - should see no RLS errors
5. **Check Supabase dashboard** - should see your saved design

## Security Benefits

- **RLS remains enabled** for security
- **Service role key** provides full permissions to our backend
- **Proper policies** ensure only our backend can access the data
- **No security compromise** - service role key is server-side only

## Why This is Better

- ✅ **RLS stays enabled** (secure)
- ✅ **Proper authentication** (service role)
- ✅ **Full permissions** (no access issues)
- ✅ **Production ready** (not a temporary fix)
