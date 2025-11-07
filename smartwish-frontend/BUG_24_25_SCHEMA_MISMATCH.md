# 🚨 Bug #24 & #25: Database Schema Mismatches (CRITICAL)

## The Critical Payment Failure

**Payment ID**: `pi_3SQZCjP3HzX85FPE11EkdtWr`  
**Order ID**: `0cd40e84-d3a1-4516-91d4-5db2e1562d02`  
**Amount**: $0.53 USD  
**Result**: Payment succeeded on Stripe, but completely failed to record in database

---

## 🔴 Bug #24: Invalid payment_method Value

**Severity**: CRITICAL 🔥🔥🔥  
**Location**: `smartwish-frontend/src/app/payment/page.tsx:234`  

### The Problem

```typescript
// ❌ BEFORE
paymentMethod: 'card_mobile',
```

**Database CHECK Constraint** (from migration):
```sql
payment_method VARCHAR(20) CHECK (payment_method IN ('card_kiosk', 'qr_mobile'))
```

**Only allows**:
- `'card_kiosk'`
- `'qr_mobile'`

**But code tried to insert**: `'card_mobile'`

### Error in Logs

```
Line 690: error: new row for relation "payment_sessions" violates check constraint 
"payment_sessions_payment_method_check"

Line 710: 'card_mobile',  ← THIS VALUE IS INVALID!

constraint: 'payment_sessions_payment_method_check',
```

### The Impact

- ✅ Order created successfully
- ❌ Payment session creation FAILED (constraint violation)
- ❌ Payment recorded on Stripe
- ❌ User charged $0.53
- ❌ NO database record
- ❌ Transaction recording also failed (secondary)

### The Fix

```typescript
// ✅ AFTER
paymentMethod: 'qr_mobile', // ✅ FIX Bug #24: Must be 'qr_mobile' not 'card_mobile' (DB constraint)
```

---

## 🔴 Bug #25: Missing Database Columns (refund fields)

**Severity**: HIGH 🔥🔥  
**Location**: `smartwish-backend/backend/src/orders/transaction.entity.ts:81-88`  

### The Problem

**TypeORM Entity defined** (lines 81-88):
```typescript
// Refund info
@Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
refundAmount?: number;

@Column({ name: 'refund_reason', type: 'text', nullable: true })
refundReason?: string;

@Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
refundedAt?: Date;
```

**But database schema** (001_create_payment_system.sql):
```sql
CREATE TABLE transactions (
  -- ... other columns ...
  -- ❌ NO refund_amount column
  -- ❌ NO refund_reason column
  -- ❌ NO refunded_at column
);
```

### Error in Logs

```
Line 782: error: column Transaction.refund_amount does not exist

Line 794: query: SELECT ... "Transaction"."refund_amount" ...
                                           ^^^^^^^^^^^^^ 
                                           Doesn't exist!
```

### The Impact

When trying to check for duplicate transactions (Bug #5 fix), the query failed because it tried to SELECT columns that don't exist:

```typescript
const existingTx = await this.ordersService.getTransactionByStripeId(
  txData.stripePaymentIntentId
);
// ❌ This query SELECTs refund_amount, refund_reason, refunded_at
// ❌ But database doesn't have these columns!
// ❌ Query fails before even checking for duplicates
```

### The Fix

**Option 1** (Applied): Remove columns from entity
```typescript
// ✅ FIX Bug #25: Removed refund columns - they don't exist in database schema
// TODO: Add these columns to database migration if refund functionality is needed
// @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
// refundAmount?: number;
```

**Option 2** (Future): Add columns to database
```sql
ALTER TABLE transactions
ADD COLUMN refund_amount DECIMAL(10, 2),
ADD COLUMN refund_reason TEXT,
ADD COLUMN refunded_at TIMESTAMP WITH TIME ZONE;
```

---

## 💥 The Cascade Effect

### What Happened Step-by-Step

1. **User scans QR code** and initiates payment
2. **Frontend creates order** ✅
   - Order ID: `0cd40e84-d3a1-4516-91d4-5db2e1562d02`
3. **Frontend creates payment intent** ✅
   - Stripe Payment Intent: `pi_3SQZCjP3HzX85FPE11EkdtWr`
4. **Frontend tries to create payment session** ❌
   - Tries to insert `payment_method: 'card_mobile'`
   - **Bug #24**: Database rejects (CHECK constraint violation)
   - Transaction ROLLED BACK
5. **User completes payment on mobile** ✅
   - Stripe charges $0.53
   - Payment succeeds
6. **Frontend tries to record transaction** ❌
   - First checks for duplicates via `getTransactionByStripeId()`
   - **Bug #25**: Query fails (refund columns don't exist)
   - Cannot record transaction
7. **Frontend shows CRITICAL ERROR** ✅
   - "Payment processed but recording failed"
   - User sees Payment ID for recovery
   - Good error handling!

---

## 🔍 Root Cause Analysis

### Why Did This Happen?

#### Bug #24:
1. **Inconsistent naming**: Code used `card_mobile`, DB expected `qr_mobile`
2. **No validation**: Frontend didn't validate against allowed values
3. **No testing**: Mobile payment flow not tested after adding DB constraints

#### Bug #25:
1. **Incomplete migration**: Entity was updated but migration wasn't
2. **Code-first development**: Entity defined columns that DB doesn't have
3. **No schema sync check**: TypeORM entity and SQL migration out of sync

---

## 🛡️ Why Bug #15 Fix Didn't Help

Bug #15 was designed to catch:
- Missing `orderId` in metadata
- Missing `accessToken` for auth
- Failed API responses

But it COULDN'T catch:
- Invalid enum values violating DB constraints
- Missing columns in SELECT queries

These are **database-level validation errors**, not application logic errors.

---

## 💾 Payment Recovery

### SQL Script: `PAYMENT_RECOVERY_SQL.sql`

**Run this to recover your payment**:

```sql
-- Update payment session (fix payment_method)
UPDATE payment_sessions
SET 
  payment_method = 'qr_mobile',  -- Fixed value
  status = 'completed',
  completed_at = NOW()
WHERE id = 'PAY-1762458714293-2w9ymr4';

-- Insert transaction record
INSERT INTO transactions (...)
VALUES (
  ...
  'pi_3SQZCjP3HzX85FPE11EkdtWr',
  ...
);

-- Update order to paid
UPDATE orders
SET status = 'paid'
WHERE id = '0cd40e84-d3a1-4516-91d4-5db2e1562d02';
```

**Full script available in**: `PAYMENT_RECOVERY_SQL.sql`

---

## ✅ Fixes Applied

### Bug #24 Fix

**File**: `smartwish-frontend/src/app/payment/page.tsx`

```typescript
// ❌ BEFORE
paymentMethod: 'card_mobile',

// ✅ AFTER
paymentMethod: 'qr_mobile', // ✅ FIX Bug #24
```

### Bug #25 Fix

**File**: `smartwish-backend/backend/src/orders/transaction.entity.ts`

```typescript
// ❌ BEFORE
@Column({ name: 'refund_amount', ... })
refundAmount?: number;

// ✅ AFTER
// Commented out (columns don't exist in DB)
// @Column({ name: 'refund_amount', ... })
// refundAmount?: number;
```

---

## 🎯 Prevention Measures

### 1. Add Enum Validation

```typescript
// payment-session.entity.ts
export enum PaymentMethod {
  CARD_KIOSK = 'card_kiosk',
  QR_MOBILE = 'qr_mobile',
}

@Column({
  type: 'enum',
  enum: PaymentMethod,
  nullable: true
})
paymentMethod?: PaymentMethod;
```

### 2. Schema Sync Check

```bash
# Add to CI/CD pipeline
npx typeorm schema:sync --check
# Fails if entity doesn't match database
```

### 3. Migration Generation

```bash
# Generate migration from entity changes
npx typeorm migration:generate -n AddRefundColumns
```

### 4. Integration Tests

```typescript
describe('Mobile Payment Flow', () => {
  it('should create payment session with valid payment_method', async () => {
    const session = await createPaymentSession({
      paymentMethod: 'qr_mobile', // Must be valid
    });
    expect(session.id).toBeDefined();
  });
});
```

---

## 📊 Bug Summary

**Total Bugs Found**: **25**
- **10 CRITICAL** 🔥🔥🔥 (including #24 & #25)
- **9 HIGH** 🔥🔥
- **6 MEDIUM** 🔥

### Data Loss Scenarios Fixed:
1. ✅ Frontend crash → webhook records
2. ✅ Network failure → explicit error
3. ✅ Missing orderId → error thrown
4. ✅ Missing accessToken → error thrown
5. ✅ **NEW**: Invalid enum value → ❌ **THIS ONE WAS NOT CAUGHT**
6. ✅ **NEW**: Missing DB columns → ❌ **THIS ONE WAS NOT CAUGHT**

---

## 🎓 Lessons Learned

### 1. Database Constraints Are Strict
Application-level validation is not enough. DB will reject invalid data.

### 2. Entity-Schema Sync is Critical
Code-first development requires discipline to keep entity and migrations in sync.

### 3. CHECK Constraints Need Documentation
Document allowed enum values where they're used in code.

### 4. Test All Paths
Mobile payment flow was never tested after adding DB constraints.

### 5. Schema Changes Need Migration
Adding columns to entity means adding them to database first.

---

## ⏭️ Next Steps

1. **IMMEDIATE**: Run `PAYMENT_RECOVERY_SQL.sql` to recover your payment
2. **TODAY**: Test the entire mobile payment flow end-to-end
3. **THIS WEEK**: Add enum validation to all entities
4. **THIS WEEK**: Add schema sync check to CI/CD
5. **LATER**: Implement refund functionality properly with migration

---

## 🎉 Status

**✅ BOTH BUGS FIXED**  
**✅ Backend compiles successfully**  
**⏳ Payment recovery pending** (run SQL script)  
**✅ Ready for testing**  

---

**The payment system is getting more robust with every bug we find!** 🛡️

Your $0.53 is safe on Stripe - just need to run the recovery SQL to record it properly.

