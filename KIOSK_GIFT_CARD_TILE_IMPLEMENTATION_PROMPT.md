# Kiosk Gift Card Tile Implementation Prompt

## Overview
Add a third tile to the `/kiosk/home` page that allows users to purchase a dedicated gift card directly from the kiosk. This tile is configurable by admins and can be enabled/disabled per kiosk. After successful payment, the user sees their gift card details (QR code, 16-digit number, PIN) and can save it by taking a photo or having it emailed.

## Requirements

### 1. Kiosk Configuration Updates

#### 1.1 Extend KioskConfig Type
**File**: `smartwish-frontend/src/app/admin/kiosks/page.tsx`

Add new configuration fields to the `KioskConfig` type:

```typescript
type KioskConfig = {
  // ... existing fields ...
  
  // Gift Card Tile Configuration
  giftCardTile?: {
    enabled: boolean;           // Master toggle - show/hide the tile
    visibility: 'visible' | 'hidden' | 'disabled';  // visible=show, hidden=don't show, disabled=show but grayed out
    brandId: string | null;     // UUID of the gift card brand to sell
    discountPercent: number;    // Discount percentage (0-100) for this kiosk
    displayName?: string;       // Optional custom display name (e.g., "Store Gift Card")
    description?: string;       // Optional custom description
    minAmount?: number;         // Override brand's min amount (optional)
    maxAmount?: number;         // Override brand's max amount (optional)
    presetAmounts?: number[];   // Quick-select amounts (e.g., [25, 50, 100, 200])
  };
};
```

#### 1.2 Update DEFAULT_CONFIG
Add default values for the gift card tile:

```typescript
const DEFAULT_CONFIG: KioskConfig = {
  // ... existing defaults ...
  
  giftCardTile: {
    enabled: false,             // Disabled by default
    visibility: 'hidden',       // Hidden by default
    brandId: null,              // No brand selected
    discountPercent: 0,         // No discount by default
    displayName: 'Gift Card',
    description: 'Purchase a gift card',
    presetAmounts: [25, 50, 100, 200],
  },
};
```

#### 1.3 Admin UI - Gift Card Tile Section
Add a new collapsible section in the kiosk edit modal to configure the gift card tile:

**UI Elements needed**:
- **Enable Tile Toggle**: Master on/off switch
- **Visibility Dropdown**: 'Show' | 'Hide' | 'Show (Disabled)'
- **Brand Selector**: Dropdown to select from active gift card brands (fetch from `/api/admin/gift-card-brands`)
- **Discount Percent**: Number input (0-100) with % suffix
- **Display Name**: Text input with placeholder
- **Description**: Textarea for custom description
- **Preset Amounts**: Chip input or comma-separated field for quick-select amounts
- **Min/Max Amount Overrides**: Optional number inputs

**Design**: Match existing configuration sections style (like surveillance config, virtual keyboard config)

### 2. Frontend - Kiosk Home Page Updates

#### 2.1 Third Tile Component
**File**: `smartwish-frontend/src/app/kiosk/home/page.tsx`

Add a third tile alongside "Greeting Cards" and "Stickers":

**Tile Requirements**:
- **Layout**: Same size and style as existing tiles (min-h-[480px] lg:min-h-[520px])
- **Conditional Rendering**: 
  - Don't render if `giftCardTile?.enabled !== true`
  - Don't render if `giftCardTile?.visibility === 'hidden'`
  - Render grayed out if `giftCardTile?.visibility === 'disabled'`
- **Visual Design**:
  - Use gradient similar to other tiles but with distinct color (e.g., emerald/teal gradient)
  - Show gift card brand logo if available
  - Display the custom `displayName` or default "Gift Card"
  - Show the description
  - If discount > 0, show a badge like "10% OFF!"
  - CTA button: "Buy Now" or "Get Gift Card"
- **Animation**: 
  - Consider showing animated gift card icons or a simple gift card image
  - Floating price tags or confetti effect for promotional feel
- **Grid Layout Update**:
  - When 3 tiles: Use `grid-cols-1 lg:grid-cols-3` or keep 2 columns with the third tile below
  - Alternative: First two tiles side by side, third tile full width below
  - Recommended: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with equal sizing

#### 2.2 Navigation Handler
```typescript
const handleSelectGiftCard = () => {
  const tileConfig = kioskConfig?.giftCardTile;
  if (!tileConfig?.enabled || tileConfig?.visibility === 'disabled') return;
  
  // Navigate to gift card purchase flow with brandId in params
  router.push(`/kiosk/gift-card?brandId=${tileConfig.brandId}`);
};
```

### 3. Gift Card Purchase Flow

#### 3.1 Create New Page: `/kiosk/gift-card`
**File**: `smartwish-frontend/src/app/kiosk/gift-card/page.tsx`

**Page Flow**:
1. **Amount Selection Screen**
2. **Payment Screen** (Stripe)
3. **Success Screen** (QR Code, Card Number, PIN display)

#### 3.2 Amount Selection Screen

**Layout**:
- Header: "Choose Gift Card Amount"
- Brand logo and name display
- Preset amount buttons (from config or brand defaults)
- Custom amount input (within min/max range)
- If discount applies: Show original price struck through and discounted price
- "Continue to Payment" button

**UI Components**:
```tsx
// Preset amount buttons
<div className="grid grid-cols-2 gap-4">
  {presetAmounts.map((amount) => (
    <button
      key={amount}
      onClick={() => setSelectedAmount(amount)}
      className={`p-6 rounded-2xl border-2 transition-all ${
        selectedAmount === amount
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 hover:border-emerald-300'
      }`}
    >
      <span className="text-3xl font-bold">${amount}</span>
      {discountPercent > 0 && (
        <div className="mt-2 text-sm text-emerald-600">
          Pay ${(amount * (1 - discountPercent / 100)).toFixed(2)}
        </div>
      )}
    </button>
  ))}
</div>

// Custom amount input
<VirtualInput
  label="Custom Amount"
  type="number"
  min={minAmount}
  max={maxAmount}
  value={customAmount}
  onChange={setCustomAmount}
/>
```

#### 3.3 Payment Screen

**Integration**: Use Stripe Elements (similar to `/marketplace` page)

**Components Needed**:
- Stripe CardElement
- Order summary showing:
  - Gift card amount
  - Discount (if applicable)
  - Final payment amount
- "Pay Now" button

**API Call**:
```typescript
// POST /api/gift-cards/purchase
const response = await fetch('/api/gift-cards/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandId: giftCardTile.brandId,
    amount: selectedAmount,
    kioskId: kioskInfo.kioskId,
    discountPercent: giftCardTile.discountPercent,
    paymentMethodId: paymentMethod.id, // From Stripe
  }),
});
```

#### 3.4 Success Screen - Gift Card Display

**This is the most important screen - user receives their gift card here**

**Layout**:
```
┌────────────────────────────────────────────┐
│                                            │
│         🎉 Your Gift Card is Ready!        │
│                                            │
│     ┌──────────────────────────────┐       │
│     │                              │       │
│     │         [QR CODE]            │       │
│     │       (Large, scannable)     │       │
│     │                              │       │
│     └──────────────────────────────┘       │
│                                            │
│       Card Number:                         │
│       1234 5678 9012 3456                  │
│       (tap to copy)                        │
│                                            │
│       PIN:                                 │
│       ● ● ● ●  [Show]                      │
│       1234 (when revealed)                 │
│                                            │
│       Balance: $100.00                     │
│       Expires: January 15, 2027            │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │  📱 Take a photo of this screen    │    │
│  │       to save your gift card       │    │
│  └────────────────────────────────────┘    │
│                                            │
│           ─── OR ───                       │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │  📧 Email my gift card             │    │
│  │  ┌────────────────────────────┐    │    │
│  │  │ your@email.com             │    │    │
│  │  └────────────────────────────┘    │    │
│  │         [Send Email]               │    │
│  └────────────────────────────────────┘    │
│                                            │
│           [Done - Return Home]             │
│                                            │
└────────────────────────────────────────────┘
```

**Component Requirements**:

##### QR Code Generation
```typescript
import QRCode from 'qrcode';

// QR code should encode:
// 1. Card number
// 2. Redemption URL (e.g., https://smartwish.com/redeem?card=XXXX)

const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

useEffect(() => {
  if (giftCard?.cardNumber) {
    const redemptionUrl = `${window.location.origin}/redeem?card=${giftCard.cardNumber}`;
    QRCode.toDataURL(redemptionUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeDataUrl);
  }
}, [giftCard?.cardNumber]);
```

##### Card Number Display
```tsx
// Format as 16 digits with spaces
const formatCardNumber = (num: string) => {
  const clean = num.replace(/\s/g, '');
  return `${clean.slice(0,4)} ${clean.slice(4,8)} ${clean.slice(8,12)} ${clean.slice(12,16)}`;
};

<div className="font-mono text-3xl tracking-wider text-center">
  {formatCardNumber(giftCard.cardNumber)}
</div>
<button 
  onClick={() => navigator.clipboard.writeText(giftCard.cardNumber)}
  className="text-sm text-indigo-600 mt-2"
>
  Tap to copy
</button>
```

##### PIN Display with Reveal Toggle
```tsx
const [showPin, setShowPin] = useState(false);

<div className="flex items-center gap-4 justify-center">
  <span className="text-sm text-gray-600">PIN:</span>
  <span className="font-mono text-2xl tracking-widest">
    {showPin ? giftCard.pin : '●●●●'}
  </span>
  <button
    onClick={() => setShowPin(!showPin)}
    className="px-3 py-1 text-sm bg-gray-100 rounded-lg"
  >
    {showPin ? 'Hide' : 'Show'}
  </button>
</div>
```

##### Email Gift Card
```tsx
const [email, setEmail] = useState('');
const [emailSending, setEmailSending] = useState(false);
const [emailSent, setEmailSent] = useState(false);

const handleEmailGiftCard = async () => {
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address');
    return;
  }
  
  setEmailSending(true);
  try {
    await fetch('/api/gift-cards/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId: giftCard.id,
        email: email,
      }),
    });
    setEmailSent(true);
  } catch (error) {
    console.error('Failed to send email:', error);
    alert('Failed to send email. Please take a photo instead.');
  } finally {
    setEmailSending(false);
  }
};

<div className="space-y-4">
  <VirtualInput
    type="email"
    placeholder="your@email.com"
    value={email}
    onChange={setEmail}
    disabled={emailSent}
  />
  <button
    onClick={handleEmailGiftCard}
    disabled={emailSending || emailSent || !email}
    className={`w-full py-4 rounded-xl font-semibold ${
      emailSent 
        ? 'bg-green-100 text-green-700' 
        : 'bg-indigo-600 text-white hover:bg-indigo-500'
    }`}
  >
    {emailSending ? 'Sending...' : emailSent ? '✓ Email Sent!' : 'Send to Email'}
  </button>
</div>
```

### 4. Backend Updates

#### 4.1 Gift Card Purchase API Updates
**File**: `smartwish-backend/backend/src/routes/giftCards.ts`

Modify the purchase endpoint to:
1. Accept `discountPercent` parameter
2. Calculate final payment amount after discount
3. Store the discount info in the transaction record
4. Track kiosk-specific purchases

```typescript
// POST /gift-cards/purchase
interface PurchaseRequest {
  brandId: string;
  amount: number;
  kioskId?: string;
  discountPercent?: number;  // New field
  paymentMethodId: string;
}

// Calculate actual charge amount
const chargeAmount = amount * (1 - (discountPercent || 0) / 100);
```

#### 4.2 Email Gift Card API
**File**: `smartwish-frontend/src/app/api/gift-cards/email/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend'; // or your email service

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { cardId, email } = await request.json();
    
    // Fetch card details from backend
    const cardResponse = await fetch(`${API_BASE}/gift-cards/${cardId}`);
    const card = await cardResponse.json();
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(
      `${process.env.NEXT_PUBLIC_APP_URL}/redeem?card=${card.cardNumber}`
    );
    
    // Send email with gift card details
    await resend.emails.send({
      from: 'SmartWish <noreply@smartwish.com>',
      to: email,
      subject: 'Your SmartWish Gift Card',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>🎁 Your Gift Card</h1>
          
          <div style="background: #f5f5f5; padding: 24px; border-radius: 12px; text-align: center;">
            <img src="${qrCode}" alt="QR Code" style="width: 200px; height: 200px;" />
            
            <p style="font-size: 14px; color: #666; margin-top: 16px;">
              Card Number
            </p>
            <p style="font-family: monospace; font-size: 24px; letter-spacing: 4px;">
              ${formatCardNumber(card.cardNumber)}
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 16px;">
              PIN
            </p>
            <p style="font-family: monospace; font-size: 20px;">
              ${card.pin}
            </p>
            
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;" />
            
            <p><strong>Balance:</strong> $${card.initialBalance.toFixed(2)}</p>
            <p><strong>Expires:</strong> ${new Date(card.expiresAt).toLocaleDateString()}</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            Keep this email safe. You'll need the card number and PIN to use your gift card.
          </p>
        </div>
      `,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to email gift card:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
```

### 5. Database Updates

#### 5.1 Track Kiosk Gift Card Purchases
Add kiosk tracking to gift card transactions:

```sql
-- Add columns to existing gift_cards table if not present
ALTER TABLE gift_cards
ADD COLUMN IF NOT EXISTS kiosk_id VARCHAR(128) REFERENCES kiosk_configs(kiosk_id),
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS charge_amount DECIMAL(10,2);
```

### 6. UI/UX Considerations

#### 6.1 Touch-Friendly Design
- All buttons minimum 48px height
- Large tap targets for amount selection
- Clear visual feedback on selection
- VirtualInput integration for email input

#### 6.2 Accessibility
- High contrast text for card number and PIN
- Large QR code (minimum 250px × 250px)
- Clear visual hierarchy
- Screen reader labels

#### 6.3 Error Handling
- Payment failure: Show clear error message, allow retry
- Network error: Provide fallback instructions
- Invalid email: Inline validation
- Session timeout: Save gift card details to localStorage as backup

#### 6.4 Timeout Protection
- Extend kiosk timeout while on success screen (user needs time to save details)
- Show countdown warning before timeout
- Offer to email gift card before session ends

### 7. Security Considerations

#### 7.1 PIN Handling
- PINs should be returned ONLY once after purchase
- After initial display, PIN should be hashed in database
- Consider: Store PIN in localStorage for session only

#### 7.2 Gift Card Protection
- Rate limit purchases per kiosk
- Log all purchases with kiosk ID
- Validate discount percentage against kiosk config server-side

### 8. Analytics & Tracking

Track the following events:
- `gift_card_tile_clicked`: User clicked the gift card tile
- `gift_card_amount_selected`: User selected an amount
- `gift_card_purchase_started`: Payment initiated
- `gift_card_purchase_completed`: Payment successful
- `gift_card_email_sent`: User emailed themselves the card
- `gift_card_photo_prompted`: User saw the "take a photo" message

### 9. Testing Checklist

- [ ] Gift card tile shows/hides based on config
- [ ] Tile displays correctly when disabled
- [ ] Discount percentage displays correctly
- [ ] Amount selection works with presets and custom amounts
- [ ] Payment flow completes successfully
- [ ] QR code generates and is scannable
- [ ] Card number displays in correct format
- [ ] PIN reveal toggle works
- [ ] Email sending works
- [ ] Copy to clipboard works
- [ ] Done button returns to home
- [ ] Kiosk timeout behavior correct on success screen
- [ ] Works on touch devices
- [ ] Grid layout adapts for 3 tiles

### 10. File Changes Summary

**New Files**:
- `smartwish-frontend/src/app/kiosk/gift-card/page.tsx` - Gift card purchase flow
- `smartwish-frontend/src/app/api/gift-cards/email/route.ts` - Email gift card API

**Modified Files**:
- `smartwish-frontend/src/app/admin/kiosks/page.tsx` - Add gift card tile config UI
- `smartwish-frontend/src/app/kiosk/home/page.tsx` - Add third tile
- `smartwish-backend/backend/src/routes/giftCards.ts` - Support discount in purchase

**Database**:
- Migration to add kiosk tracking columns to gift_cards table

### 11. Implementation Order

1. **Phase 1**: Kiosk Config Updates
   - Update KioskConfig type
   - Add DEFAULT_CONFIG values
   - Build admin UI for gift card tile configuration

2. **Phase 2**: Kiosk Home Page Tile
   - Add third tile component
   - Update grid layout
   - Implement conditional rendering

3. **Phase 3**: Gift Card Purchase Flow
   - Create `/kiosk/gift-card` page
   - Amount selection screen
   - Integrate with existing payment flow

4. **Phase 4**: Success Screen
   - QR code generation
   - Card number and PIN display
   - Email functionality

5. **Phase 5**: Backend & Email
   - Update purchase API for discounts
   - Create email API endpoint
   - Database migration

6. **Phase 6**: Polish & Testing
   - Timeout handling
   - Error states
   - Analytics
   - Cross-device testing
