# Backend Fix Needed: Public Card Price Endpoint

## Problem

The frontend needs to fetch card prices for the payment modal, but the current `/api/saved-designs/:id` endpoint requires JWT authentication and matches `author_id` with the authenticated user.

When the frontend tries to fetch the card price:
- ❌ It gets 404 because it can't authenticate
- ❌ Falls back to default price of $2.99
- ❌ Shows wrong price to users

## Proper Solution

Create a **public endpoint** that returns ONLY the price and basic info (no sensitive data):

### New Backend Endpoint

**File:** `smartwish-backend/backend/src/saved-designs/saved-designs.controller.ts`

Add this new endpoint:

```typescript
@Get('public/:id/price')
async getCardPrice(
  @Param('id') cardId: string,
  @Res() res: Response,
) {
  try {
    const card = await this.savedDesignsService.getPublicCardPrice(cardId);
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    // Return only non-sensitive data needed for pricing
    res.json({
      id: card.id,
      title: card.title,
      price: card.price,
      hasGiftCard: !!card.metadata?.giftCard,
      giftCardAmount: card.metadata?.giftCard?.amount || 0
    });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch card price', error: (e as any)?.message });
  }
}
```

### New Service Method

**File:** `smartwish-backend/backend/src/saved-designs/supabase-saved-designs.service.ts`

Add this method:

```typescript
async getPublicCardPrice(designId: string): Promise<SavedDesign | null> {
  if (!this.supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await this.supabase
    .from('saved_designs')
    .select('id, title, price, metadata')
    .eq('id', designId)
    .single();

  if (error) {
    console.error('Error fetching card price from Supabase:', error);
    return null;
  }

  return this.mapDatabaseRecordToSavedDesign(data);
}
```

Then add this to the service interface:

```typescript
async getPublicCardPrice(designId: string): Promise<SavedDesign | null> {
  return await this.supabaseService.getPublicCardPrice(designId);
}
```

### Update Frontend

**File:** `smartwish-frontend/src/app/api/cards/calculate-price/route.ts`

Change line 21 to:

```typescript
const cardUrl = `${backendUrl}/api/saved-designs/public/${cardId}/price`
```

## Why This Is The Proper Way

1. **Security**: No authentication needed for public, non-sensitive data (prices)
2. **Performance**: Direct query, no JWT overhead
3. **Separation of Concerns**: Price calculation doesn't need full user authentication
4. **Better UX**: Users can see prices immediately
5. **Production Ready**: Standard practice for e-commerce applications

## Alternative (If You Don't Want Public Endpoint)

If you want to keep prices private (unusual for an e-commerce app), then you need to:

1. Make the frontend pass the user's JWT token properly
2. Ensure the card's `author_id` matches the authenticated user
3. Handle guest users appropriately

But for a payment flow, **prices should be public**.

## Quick Test

After adding the endpoint, test it:

```bash
curl http://localhost:3001/api/saved-designs/public/5ebb0c5f-bc91-4e76-ae21-5156c2556f96/price
```

Should return:

```json
{
  "id": "5ebb0c5f-bc91-4e76-ae21-5156c2556f96",
  "title": "Birthday Card",
  "price": 0.01,
  "hasGiftCard": false,
  "giftCardAmount": 0
}
```

---

**This is the professional, production-ready solution.** 

Would you like me to help implement this in the backend?


