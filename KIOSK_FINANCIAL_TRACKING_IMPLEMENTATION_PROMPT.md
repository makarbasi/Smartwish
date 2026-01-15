# Kiosk Financial Tracking & Commission System - Implementation Prompt

## Overview

Implement a complete financial tracking and commission distribution system for Smartwish kiosks. Each kiosk is an independent revenue-generating entity with a manager and optional sales representative who earn commissions based on specific rules per product type.

---

## Database Schema

### 1. Sales Representatives Table

```sql
CREATE TABLE sales_representatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    
    -- Authentication (they can login)
    auth_user_id UUID REFERENCES auth.users(id),
    
    -- Commission Settings
    commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,  -- e.g., 10.00 = 10%
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)  -- Admin who created this record
);

-- Index for quick lookups
CREATE INDEX idx_sales_reps_email ON sales_representatives(email);
CREATE INDEX idx_sales_reps_auth_user ON sales_representatives(auth_user_id);
```

### 2. Update Kiosk Configuration Table

Add sales representative assignment to existing kiosk config:

```sql
ALTER TABLE kiosk_configurations ADD COLUMN IF NOT EXISTS 
    sales_representative_id UUID REFERENCES sales_representatives(id);

-- Manager commission percent (if not already exists)
ALTER TABLE kiosk_configurations ADD COLUMN IF NOT EXISTS 
    manager_commission_percent DECIMAL(5,2) DEFAULT 0.00;
```

### 3. Earnings Ledger Table

Track every earning event with party-specific breakdowns:

```sql
CREATE TABLE earnings_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction Reference
    kiosk_id UUID NOT NULL REFERENCES kiosk_configurations(id),
    transaction_type VARCHAR(50) NOT NULL,  -- 'greeting_card', 'sticker', 'ecard', 'generic_gift_card', 'custom_gift_card_purchase', 'custom_gift_card_redemption'
    transaction_id UUID,  -- Reference to the original transaction (order_id, gift_card_id, etc.)
    
    -- Financial Breakdown (all in cents or dollars - be consistent, recommend cents)
    gross_amount DECIMAL(10,2) NOT NULL,          -- Total charged to customer
    processing_fees DECIMAL(10,2) DEFAULT 0,      -- Stripe fees
    state_tax DECIMAL(10,2) DEFAULT 0,            -- Sales tax collected
    cost_basis DECIMAL(10,2) DEFAULT 0,           -- Any product costs
    
    -- Net amount available for distribution
    net_distributable DECIMAL(10,2) NOT NULL,     -- gross - fees - tax - costs
    
    -- Commission Distributions
    smartwish_earnings DECIMAL(10,2) DEFAULT 0,
    manager_earnings DECIMAL(10,2) DEFAULT 0,
    manager_id UUID REFERENCES auth.users(id),
    manager_commission_rate DECIMAL(5,2),         -- Rate at time of transaction
    
    sales_rep_earnings DECIMAL(10,2) DEFAULT 0,
    sales_rep_id UUID REFERENCES sales_representatives(id),
    sales_rep_commission_rate DECIMAL(5,2),       -- Rate at time of transaction
    
    -- For custom gift cards - store payout tracking
    store_payout DECIMAL(10,2) DEFAULT 0,
    store_id UUID,  -- Reference to the store if applicable
    
    -- Metadata
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    
    -- Timestamps
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- For gift card redemptions, link to original purchase
    related_ledger_id UUID REFERENCES earnings_ledger(id)
);

-- Indexes for reporting
CREATE INDEX idx_earnings_kiosk ON earnings_ledger(kiosk_id);
CREATE INDEX idx_earnings_manager ON earnings_ledger(manager_id);
CREATE INDEX idx_earnings_sales_rep ON earnings_ledger(sales_rep_id);
CREATE INDEX idx_earnings_type ON earnings_ledger(transaction_type);
CREATE INDEX idx_earnings_date ON earnings_ledger(transaction_date);
```

### 4. Earnings Summary View (for quick dashboard queries)

```sql
CREATE OR REPLACE VIEW manager_earnings_summary AS
SELECT 
    manager_id,
    kiosk_id,
    DATE_TRUNC('month', transaction_date) as month,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(gross_amount) as total_gross,
    SUM(manager_earnings) as total_earnings
FROM earnings_ledger
WHERE manager_id IS NOT NULL
GROUP BY manager_id, kiosk_id, DATE_TRUNC('month', transaction_date), transaction_type;

CREATE OR REPLACE VIEW sales_rep_earnings_summary AS
SELECT 
    sales_rep_id,
    kiosk_id,
    DATE_TRUNC('month', transaction_date) as month,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(gross_amount) as total_gross,
    SUM(sales_rep_earnings) as total_earnings
FROM earnings_ledger
WHERE sales_rep_id IS NOT NULL
GROUP BY sales_rep_id, kiosk_id, DATE_TRUNC('month', transaction_date), transaction_type;
```

---

## Commission Calculation Rules by Product Type

### CRITICAL PRINCIPLE
> Commissions are calculated on **net revenue** (original price minus costs/fees), NOT on gross amount.
> 
> Example: $10 product - $3 processing fees = $7 net → 20% commission = $1.40

---

### 1. Greeting Cards & Stickers

**Commission: YES (both manager and sales rep)**

```typescript
interface PrintProductEarnings {
  grossAmount: number;        // What customer paid
  processingFees: number;     // Stripe fees (2.9% + $0.30)
  stateTax: number;           // State sales tax
  productCost: number;        // Paper, ink, etc. (if any)
}

function calculatePrintProductCommission(
  earnings: PrintProductEarnings,
  managerCommissionRate: number,  // e.g., 0.20 for 20%
  salesRepCommissionRate: number  // e.g., 0.10 for 10%
): CommissionBreakdown {
  // Net distributable = gross - fees - tax - costs
  const netDistributable = earnings.grossAmount 
    - earnings.processingFees 
    - earnings.stateTax 
    - earnings.productCost;
  
  // Calculate commissions on NET amount
  const managerEarnings = netDistributable * managerCommissionRate;
  const salesRepEarnings = netDistributable * salesRepCommissionRate;
  const smartwishEarnings = netDistributable - managerEarnings - salesRepEarnings;
  
  return {
    netDistributable,
    managerEarnings,
    salesRepEarnings,
    smartwishEarnings
  };
}
```

**Example:**
- Customer pays: $5.00 for greeting card
- Processing fees: $0.45 (Stripe)
- State tax (8.5%): $0.43
- Product cost: $0.50
- **Net distributable: $5.00 - $0.45 - $0.43 - $0.50 = $3.62**
- Manager (20%): $0.72
- Sales Rep (10%): $0.36
- Smartwish: $2.54

---

### 2. E-Cards (Digital Sending)

**Commission: NO (neither manager nor sales rep)**

```typescript
function calculateEcardEarnings(): EcardBreakdown {
  const ECARD_PRICE = 1.00;           // $1.00 flat fee
  const PROCESSING_FEE = 0.19;        // Fixed processing fee
  
  const grossAmount = ECARD_PRICE + PROCESSING_FEE;  // $1.19 total charged
  
  return {
    grossAmount,
    processingFees: PROCESSING_FEE,
    stateTax: 0,  // No tax on digital goods (verify by state)
    managerEarnings: 0,      // NO commission
    salesRepEarnings: 0,     // NO commission
    smartwishEarnings: ECARD_PRICE  // Smartwish keeps the $1.00
  };
}
```

---

### 3. Generic Gift Cards (Tillo)

**Commission: NO (neither manager nor sales rep)**

Only charge customer the Stripe processing fees on top of face value.

```typescript
function calculateGenericGiftCardEarnings(faceValue: number): GiftCardBreakdown {
  // Stripe fee on face value
  const stripeFee = (faceValue * 0.029) + 0.30;
  
  // Customer pays face value + stripe fee
  const grossAmount = faceValue + stripeFee;
  
  return {
    grossAmount,
    faceValue,
    processingFees: stripeFee,
    managerEarnings: 0,      // NO commission
    salesRepEarnings: 0,     // NO commission
    smartwishEarnings: 0     // We just pass through, no profit
    // Note: Tillo may provide a small margin - track separately if needed
  };
}
```

---

### 4. Custom Gift Cards (Store-Specific)

**Commission: Manager ONLY at redemption time, NO sales rep commission**

This is a two-phase process:

#### Phase 1: Purchase (Customer buys gift card)

- Customer gets discount = smartwish_discount + manager_discount
- NO processing fees charged to customer (only face value minus discounts)
- NO commission distributed yet
- NO store credit yet

```typescript
interface CustomGiftCardConfig {
  faceValue: number;
  smartwishDiscountPercent: number;  // e.g., 4%
  managerDiscountPercent: number;    // e.g., 4%
  serviceFeePercent: number;         // e.g., 8% (charged to store at redemption)
}

function calculateCustomGiftCardPurchase(config: CustomGiftCardConfig) {
  const totalDiscountPercent = config.smartwishDiscountPercent + config.managerDiscountPercent;
  const discountAmount = config.faceValue * (totalDiscountPercent / 100);
  const customerPays = config.faceValue - discountAmount;
  
  // Stripe fee on what customer pays
  const stripeFee = (customerPays * 0.029) + 0.30;
  const totalCharged = customerPays + stripeFee;
  
  return {
    faceValue: config.faceValue,
    discountGiven: discountAmount,
    customerPays: customerPays,
    stripeFee: stripeFee,
    totalCharged: totalCharged,
    // NO earnings distributed yet - wait for redemption
    managerEarnings: 0,
    salesRepEarnings: 0,
    smartwishEarnings: 0
  };
}
```

**Example (Purchase):**
- Face value: $100
- Smartwish discount: 4% = $4
- Manager discount: 4% = $4
- **Customer pays: $100 - $8 = $92**
- Stripe fee on $92: $2.97
- **Total charged: $94.97**
- Money in bank: $92 (after Stripe takes their fee)

#### Phase 2: Redemption (Customer uses gift card at store)

Use the settlement calculation logic from `calculate.py`:

```typescript
interface RedemptionData {
  giftCardValue: number;           // Original face value ($100)
  totalRedemptionValue: number;    // Amount swiped at store
  kioskDiscountPercent: number;    // Smartwish discount (4%)
  storeDiscountPercent: number;    // Manager discount (4%)
  serviceFeePercent: number;       // Service fee (8%)
}

function calculateCustomGiftCardRedemption(data: RedemptionData) {
  const A = data.giftCardValue;
  const m_total = data.totalRedemptionValue;
  
  const x_pct = data.kioskDiscountPercent / 100;
  const y_pct = data.storeDiscountPercent / 100;
  const f_pct = data.serviceFeePercent / 100;
  
  // Stripe fee (calculated on face value, prorated by usage)
  const stripeFeeTotal = (0.029 * A) + 0.30;
  const usageRatio = m_total / A;
  const stripeFeeShare = stripeFeeTotal * usageRatio;
  
  // Calculate on total swiped amount
  const serviceFeeAmt = f_pct * m_total;
  const storeDiscountAmt = y_pct * m_total;
  const kioskDiscountAmt = x_pct * m_total;
  
  // Store payout
  const storePayout = m_total - serviceFeeAmt - stripeFeeShare - storeDiscountAmt;
  
  // Manager earnings = store discount amount (what manager "funded")
  // The manager discount was given to customer, so manager's profit comes from service fee
  const managerEarnings = storeDiscountAmt;  // Manager gets their discount portion back via service fee structure
  
  // Kiosk (Smartwish) net profit
  const kioskNetProfit = serviceFeeAmt - kioskDiscountAmt;
  
  return {
    storePayout: Math.round(storePayout * 100) / 100,
    managerEarnings: Math.round(managerEarnings * 100) / 100,
    salesRepEarnings: 0,  // NO sales rep commission on custom gift cards
    smartwishEarnings: Math.round(kioskNetProfit * 100) / 100,
    stripeFeeReimbursed: Math.round(stripeFeeShare * 100) / 100
  };
}
```

**Example (Redemption):**
- Face value: $100, Customer swipes full $100 at store
- Service fee (8%): $8.00
- Store discount deducted (4%): $4.00
- Kiosk discount absorbed (4%): $4.00
- Stripe fee share: $3.20
- **Store payout: $100 - $8 - $3.20 - $4 = $84.80**
- **Manager earnings: $4.00** (their discount portion)
- **Smartwish earnings: $8 - $4 = $4.00**
- Sales rep earnings: $0

---

## Backend Implementation

### 1. Sales Representative Service

```typescript
// smartwish-backend/backend/src/sales-representatives/sales-representatives.service.ts

@Injectable()
export class SalesRepresentativesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly authService: AuthService
  ) {}

  async create(dto: CreateSalesRepDto, adminUserId: string): Promise<SalesRepresentative> {
    // 1. Create auth user for the sales rep (so they can login)
    const authUser = await this.authService.createUser({
      email: dto.email,
      password: dto.temporaryPassword,
      role: 'sales_representative'
    });

    // 2. Create sales rep record
    const { data, error } = await this.supabase.client
      .from('sales_representatives')
      .insert({
        first_name: dto.firstName,
        last_name: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        auth_user_id: authUser.id,
        commission_percent: dto.commissionPercent,
        created_by: adminUserId
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async assignToKiosk(salesRepId: string, kioskId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('kiosk_configurations')
      .update({ sales_representative_id: salesRepId })
      .eq('id', kioskId);

    if (error) throw new BadRequestException(error.message);
  }

  async getEarnings(salesRepId: string, filters?: EarningsFilter): Promise<EarningsReport> {
    let query = this.supabase.client
      .from('earnings_ledger')
      .select(`
        *,
        kiosk:kiosk_configurations(name, location)
      `)
      .eq('sales_rep_id', salesRepId)
      .order('transaction_date', { ascending: false });

    if (filters?.kioskId) {
      query = query.eq('kiosk_id', filters.kioskId);
    }
    if (filters?.startDate) {
      query = query.gte('transaction_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    // Calculate totals
    const totalEarnings = data.reduce((sum, row) => sum + row.sales_rep_earnings, 0);
    const earningsByKiosk = this.groupByKiosk(data);

    return {
      transactions: data.map(row => ({
        id: row.id,
        date: row.transaction_date,
        kioskName: row.kiosk?.name,
        productType: row.transaction_type,
        productName: row.product_name,
        yourEarnings: row.sales_rep_earnings,  // Only show THEIR share
        // Do NOT expose: gross_amount, smartwish_earnings, manager_earnings
      })),
      totalEarnings,
      earningsByKiosk
    };
  }
}
```

### 2. Earnings Service

```typescript
// smartwish-backend/backend/src/earnings/earnings.service.ts

@Injectable()
export class EarningsService {
  constructor(private readonly supabase: SupabaseService) {}

  async recordPrintProductSale(data: PrintProductSaleData): Promise<void> {
    const kiosk = await this.getKioskWithCommissions(data.kioskId);
    
    // Calculate net distributable
    const netDistributable = data.grossAmount 
      - data.processingFees 
      - data.stateTax 
      - (data.productCost || 0);

    // Calculate commissions
    const managerRate = kiosk.manager_commission_percent / 100;
    const salesRepRate = kiosk.sales_representative?.commission_percent / 100 || 0;

    const managerEarnings = netDistributable * managerRate;
    const salesRepEarnings = kiosk.sales_representative_id 
      ? netDistributable * salesRepRate 
      : 0;
    const smartwishEarnings = netDistributable - managerEarnings - salesRepEarnings;

    await this.supabase.client.from('earnings_ledger').insert({
      kiosk_id: data.kioskId,
      transaction_type: data.type, // 'greeting_card' or 'sticker'
      transaction_id: data.orderId,
      gross_amount: data.grossAmount,
      processing_fees: data.processingFees,
      state_tax: data.stateTax,
      cost_basis: data.productCost || 0,
      net_distributable: netDistributable,
      smartwish_earnings: smartwishEarnings,
      manager_earnings: managerEarnings,
      manager_id: kiosk.manager_id,
      manager_commission_rate: kiosk.manager_commission_percent,
      sales_rep_earnings: salesRepEarnings,
      sales_rep_id: kiosk.sales_representative_id,
      sales_rep_commission_rate: kiosk.sales_representative?.commission_percent,
      product_name: data.productName,
      quantity: data.quantity,
      customer_name: data.customerName
    });
  }

  async recordEcardSale(data: EcardSaleData): Promise<void> {
    const ECARD_PRICE = 1.00;
    const PROCESSING_FEE = 0.19;

    await this.supabase.client.from('earnings_ledger').insert({
      kiosk_id: data.kioskId,
      transaction_type: 'ecard',
      transaction_id: data.ecardId,
      gross_amount: ECARD_PRICE + PROCESSING_FEE,
      processing_fees: PROCESSING_FEE,
      state_tax: 0,
      net_distributable: ECARD_PRICE,
      smartwish_earnings: ECARD_PRICE,
      manager_earnings: 0,      // NO commission
      sales_rep_earnings: 0,    // NO commission
      product_name: 'E-Card',
      customer_name: data.customerName
    });
  }

  async recordGenericGiftCardSale(data: GenericGiftCardData): Promise<void> {
    const stripeFee = (data.faceValue * 0.029) + 0.30;

    await this.supabase.client.from('earnings_ledger').insert({
      kiosk_id: data.kioskId,
      transaction_type: 'generic_gift_card',
      transaction_id: data.giftCardId,
      gross_amount: data.faceValue + stripeFee,
      processing_fees: stripeFee,
      state_tax: 0,
      net_distributable: 0,  // Pass-through, no profit
      smartwish_earnings: 0,
      manager_earnings: 0,
      sales_rep_earnings: 0,
      product_name: data.giftCardBrand,
      customer_name: data.customerName
    });
  }

  async recordCustomGiftCardPurchase(data: CustomGiftCardPurchaseData): Promise<void> {
    const totalDiscount = data.smartwishDiscountPercent + data.managerDiscountPercent;
    const discountAmount = data.faceValue * (totalDiscount / 100);
    const customerPays = data.faceValue - discountAmount;
    const stripeFee = (customerPays * 0.029) + 0.30;

    // Record purchase - NO earnings distributed yet
    await this.supabase.client.from('earnings_ledger').insert({
      kiosk_id: data.kioskId,
      transaction_type: 'custom_gift_card_purchase',
      transaction_id: data.giftCardId,
      gross_amount: customerPays + stripeFee,
      processing_fees: stripeFee,
      state_tax: 0,
      net_distributable: 0,  // Earnings calculated at redemption
      smartwish_earnings: 0,
      manager_earnings: 0,
      sales_rep_earnings: 0,
      product_name: `${data.storeName} Gift Card`,
      customer_name: data.customerName
    });
  }

  async recordCustomGiftCardRedemption(data: CustomGiftCardRedemptionData): Promise<void> {
    const kiosk = await this.getKioskWithCommissions(data.kioskId);
    
    // Use the settlement calculation logic
    const settlement = this.calculateSettlement({
      giftCardValue: data.faceValue,
      totalRedemptionValue: data.amountRedeemed,
      kioskDiscountPercent: data.smartwishDiscountPercent,
      storeDiscountPercent: data.managerDiscountPercent,
      serviceFeePercent: data.serviceFeePercent
    });

    await this.supabase.client.from('earnings_ledger').insert({
      kiosk_id: data.kioskId,
      transaction_type: 'custom_gift_card_redemption',
      transaction_id: data.redemptionId,
      related_ledger_id: data.purchaseLedgerId,
      gross_amount: data.amountRedeemed,
      processing_fees: settlement.stripeFeeReimbursed,
      net_distributable: settlement.smartwishEarnings + settlement.managerEarnings,
      smartwish_earnings: settlement.smartwishEarnings,
      manager_earnings: settlement.managerEarnings,
      manager_id: kiosk.manager_id,
      manager_commission_rate: data.managerDiscountPercent,
      sales_rep_earnings: 0,  // NO sales rep commission
      store_payout: settlement.storePayout,
      store_id: data.storeId,
      product_name: `${data.storeName} Gift Card Redemption`,
      customer_name: data.customerName
    });
  }

  private calculateSettlement(data: SettlementInput): SettlementOutput {
    const A = data.giftCardValue;
    const m_total = data.totalRedemptionValue;
    
    const x_pct = data.kioskDiscountPercent / 100;
    const y_pct = data.storeDiscountPercent / 100;
    const f_pct = data.serviceFeePercent / 100;
    
    const stripeFeeTotal = (0.029 * A) + 0.30;
    const usageRatio = m_total / A;
    const stripeFeeShare = stripeFeeTotal * usageRatio;
    
    const serviceFeeAmt = f_pct * m_total;
    const storeDiscountAmt = y_pct * m_total;
    const kioskDiscountAmt = x_pct * m_total;
    
    const storePayout = m_total - serviceFeeAmt - stripeFeeShare - storeDiscountAmt;
    const kioskNetProfit = serviceFeeAmt - kioskDiscountAmt;

    return {
      storePayout: Math.round(storePayout * 100) / 100,
      managerEarnings: Math.round(storeDiscountAmt * 100) / 100,
      smartwishEarnings: Math.round(kioskNetProfit * 100) / 100,
      stripeFeeReimbursed: Math.round(stripeFeeShare * 100) / 100
    };
  }
}
```

---

## Frontend Implementation

### 1. Admin: Sales Representative Management

**Location:** `smartwish-frontend/src/app/admin/sales-representatives/`

```typescript
// Components needed:
// 1. SalesRepresentativesList.tsx - Table of all sales reps with actions
// 2. CreateSalesRepDialog.tsx - Form to add new sales rep
// 3. AssignToKioskDialog.tsx - Dropdown to assign rep to a kiosk

interface CreateSalesRepForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  commissionPercent: number;  // Default 10
  temporaryPassword: string;
}
```

### 2. Admin: Kiosk Configuration Update

Add sales rep assignment dropdown to existing kiosk config form:

```tsx
// In kiosk configuration form, add:
<FormField
  label="Sales Representative"
  name="salesRepresentativeId"
>
  <Select
    options={salesReps.map(rep => ({
      value: rep.id,
      label: `${rep.firstName} ${rep.lastName} (${rep.commissionPercent}%)`
    }))}
    placeholder="Select sales representative (optional)"
    isClearable
  />
</FormField>

<FormField
  label="Manager Commission %"
  name="managerCommissionPercent"
  type="number"
  min={0}
  max={100}
  step={0.5}
/>
```

### 3. Manager Dashboard: Earnings View

**Location:** `smartwish-frontend/src/app/manager/earnings/`

```tsx
// ManagerEarningsPage.tsx
export function ManagerEarningsPage() {
  const { data: earnings } = useManagerEarnings(filters);
  
  return (
    <div>
      <h1>My Earnings</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard title="Total Earnings" value={earnings.totalEarnings} />
        <SummaryCard title="This Month" value={earnings.thisMonth} />
        <SummaryCard title="Pending Payout" value={earnings.pendingPayout} />
      </div>
      
      {/* Earnings by Kiosk */}
      <EarningsByKioskChart data={earnings.byKiosk} />
      
      {/* Transaction History */}
      <TransactionTable 
        data={earnings.transactions}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'kioskName', label: 'Kiosk' },
          { key: 'productType', label: 'Type' },
          { key: 'productName', label: 'Product' },
          { key: 'yourEarnings', label: 'Your Earnings' },  // Only their share!
        ]}
      />
    </div>
  );
}
```

### 4. Sales Representative Dashboard

**Location:** `smartwish-frontend/src/app/sales-rep/`

Create a new role-based section for sales representatives:

```tsx
// SalesRepDashboard.tsx
export function SalesRepDashboard() {
  const { user } = useAuth();
  const { data: earnings } = useSalesRepEarnings(user.salesRepId, filters);
  
  return (
    <div>
      <h1>My Sales Earnings</h1>
      
      {/* Only show THEIR earnings, not full transaction amounts */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard title="Total Earnings" value={earnings.totalEarnings} />
        <SummaryCard title="This Month" value={earnings.thisMonth} />
      </div>
      
      {/* Earnings by Kiosk they're assigned to */}
      <h2>Earnings by Kiosk</h2>
      {earnings.byKiosk.map(kiosk => (
        <KioskEarningsCard 
          key={kiosk.id}
          kioskName={kiosk.name}
          totalEarnings={kiosk.totalEarnings}
          transactionCount={kiosk.transactionCount}
        />
      ))}
      
      {/* Transaction History - LIMITED INFO */}
      <h2>Recent Transactions</h2>
      <TransactionTable 
        data={earnings.transactions}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'kioskName', label: 'Kiosk' },
          { key: 'productType', label: 'Type' },
          { key: 'yourEarnings', label: 'Your Commission' },
          // NO: grossAmount, managerEarnings, smartwishEarnings
        ]}
      />
    </div>
  );
}
```

---

## API Endpoints

### Sales Representatives

```
POST   /api/admin/sales-representatives          - Create new sales rep
GET    /api/admin/sales-representatives          - List all sales reps
GET    /api/admin/sales-representatives/:id      - Get sales rep details
PUT    /api/admin/sales-representatives/:id      - Update sales rep
DELETE /api/admin/sales-representatives/:id      - Deactivate sales rep
POST   /api/admin/sales-representatives/:id/assign-kiosk  - Assign to kiosk
```

### Earnings

```
GET    /api/manager/earnings                     - Get manager's earnings (filtered by their kiosks)
GET    /api/manager/earnings/summary             - Get earnings summary
GET    /api/manager/earnings/export              - Export to CSV

GET    /api/sales-rep/earnings                   - Get sales rep's earnings
GET    /api/sales-rep/earnings/summary           - Get earnings summary

GET    /api/admin/earnings/all                   - Admin view of all earnings
GET    /api/admin/earnings/by-kiosk/:kioskId     - Earnings for specific kiosk
GET    /api/admin/earnings/report                - Generate financial report
```

---

## Commission Summary Table

| Product Type | Manager Commission | Sales Rep Commission | Notes |
|--------------|-------------------|---------------------|-------|
| Greeting Cards | ✅ Yes (% of net) | ✅ Yes (% of net) | Net = gross - fees - tax - costs |
| Stickers | ✅ Yes (% of net) | ✅ Yes (% of net) | Same as greeting cards |
| E-Cards | ❌ No | ❌ No | Flat $1 + $0.19, all to Smartwish |
| Generic Gift Cards (Tillo) | ❌ No | ❌ No | Pass-through, only Stripe fees |
| Custom Gift Cards - Purchase | ❌ No (pending) | ❌ No | Earnings calculated at redemption |
| Custom Gift Cards - Redemption | ✅ Yes (store discount %) | ❌ No | Manager gets their discount back |

---

## Security & Access Control

### Row Level Security (RLS)

```sql
-- Sales reps can only see their own earnings
CREATE POLICY sales_rep_earnings_policy ON earnings_ledger
  FOR SELECT
  USING (
    sales_rep_id = (
      SELECT id FROM sales_representatives 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Managers can only see earnings from their kiosks
CREATE POLICY manager_earnings_policy ON earnings_ledger
  FOR SELECT
  USING (
    manager_id = auth.uid()
  );

-- Admins can see everything
CREATE POLICY admin_earnings_policy ON earnings_ledger
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Testing Scenarios

### Test Case 1: Greeting Card Sale
- Customer buys $5 greeting card
- Processing fee: $0.45
- Tax (8.5%): $0.43
- Product cost: $0.50
- Net: $3.62
- Manager (20%): $0.72
- Sales Rep (10%): $0.36
- Smartwish: $2.54

### Test Case 2: Custom Gift Card Full Flow
1. **Purchase:** $100 face value, 8% total discount
   - Customer pays: $92 + Stripe fee
   - No earnings distributed
2. **Redemption:** Customer uses full $100
   - Store payout: $84.80
   - Manager earnings: $4.00
   - Smartwish earnings: $4.00
   - Sales rep: $0

### Test Case 3: E-Card
- Customer pays: $1.19
- Processing: $0.19
- Smartwish gets: $1.00
- Manager: $0
- Sales rep: $0

---

## Migration Steps

1. Create `sales_representatives` table
2. Add columns to `kiosk_configurations`
3. Create `earnings_ledger` table
4. Create summary views
5. Set up RLS policies
6. Add new role: `sales_representative`
7. Update existing transaction handlers to record earnings
8. Build admin UI for sales rep management
9. Build manager/sales rep earnings dashboards
10. Backfill historical transactions (optional)
