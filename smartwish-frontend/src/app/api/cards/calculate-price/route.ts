import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId } = body

    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      )
    }

    // Fetch card data from saved-designs API
    const cardResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/saved-designs/${cardId}`, {
      headers: {
        'Authorization': request.headers.get('authorization') || '',
      },
    })

    if (!cardResponse.ok) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    const cardData = await cardResponse.json()

    // Get card price from database (default to 0 if not set)
    const cardPrice = parseFloat(cardData.price || 0)

    // Check if card has a gift card attached
    let giftCardAmount = 0
    
    // Try to get gift card amount from metadata or localStorage will be checked client-side
    if (cardData.metadata?.giftCard?.amount) {
      giftCardAmount = parseFloat(cardData.metadata.giftCard.amount)
    }

    // Calculate subtotal
    const subtotal = cardPrice + giftCardAmount

    // Calculate 5% processing fee
    const processingFee = subtotal * 0.05

    // Calculate total
    const total = subtotal + processingFee

    console.log('💰 Price Calculation:', {
      cardId,
      cardPrice,
      giftCardAmount,
      subtotal,
      processingFee: processingFee.toFixed(2),
      total: total.toFixed(2)
    })

    return NextResponse.json({
      success: true,
      cardPrice: parseFloat(cardPrice.toFixed(2)),
      giftCardAmount: parseFloat(giftCardAmount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      processingFee: parseFloat(processingFee.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency: 'USD',
      breakdown: {
        cardPrice: {
          label: 'Greeting Card',
          amount: parseFloat(cardPrice.toFixed(2))
        },
        giftCardAmount: giftCardAmount > 0 ? {
          label: 'Gift Card',
          amount: parseFloat(giftCardAmount.toFixed(2))
        } : null,
        processingFee: {
          label: 'Processing Fee (5%)',
          amount: parseFloat(processingFee.toFixed(2))
        }
      }
    })
  } catch (error: any) {
    console.error('Error calculating price:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

