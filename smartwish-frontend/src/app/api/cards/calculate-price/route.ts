import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId, giftCardAmount: providedGiftCardAmount } = body

    console.log('💰 Calculate Price - Request:', { cardId, providedGiftCardAmount })

    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      )
    }

    // Try to fetch card data from saved-designs API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
    console.log('💰 Backend URL:', backendUrl)
    
    const cardUrl = `${backendUrl}/api/saved-designs/${cardId}`
    console.log('💰 Fetching card from:', cardUrl)

    let cardData = null
    let cardPrice = 2.99 // Default price if we can't fetch from database

    try {
      const cardResponse = await fetch(cardUrl, {
        headers: {
          'Authorization': request.headers.get('authorization') || '',
        },
      })

      console.log('💰 Card fetch response status:', cardResponse.status)

      if (cardResponse.ok) {
        cardData = await cardResponse.json()
        console.log('💰 Card data received:', { 
          id: cardData.id, 
          title: cardData.title,
          price: cardData.price,
          hasMetadata: !!cardData.metadata
        })
        
        // Get card price from database (default to 2.99 if not set)
        cardPrice = parseFloat(cardData.price || 2.99)
      } else {
        console.warn('💰 Card not found in database, using default price')
      }
    } catch (fetchError) {
      console.error('💰 Error fetching card:', fetchError)
      console.log('💰 Using default price instead')
    }

    // Check if card has a gift card attached
    let giftCardAmount = 0
    
    // Priority 1: Use provided gift card amount from request
    if (providedGiftCardAmount && !isNaN(parseFloat(providedGiftCardAmount))) {
      giftCardAmount = parseFloat(providedGiftCardAmount)
      console.log('💰 Using provided gift card amount:', giftCardAmount)
    }
    // Priority 2: Try to get gift card amount from metadata
    else if (cardData?.metadata?.giftCard?.amount) {
      giftCardAmount = parseFloat(cardData.metadata.giftCard.amount)
      console.log('💰 Using gift card from metadata:', giftCardAmount)
    } else {
      console.log('💰 No gift card attached')
    }

    // Calculate subtotal
    const subtotal = cardPrice + giftCardAmount

    // Calculate 5% processing fee
    const processingFee = subtotal * 0.05

    // Calculate total
    const total = subtotal + processingFee

    console.log('💰 Price Calculation Result:', {
      cardId,
      cardPrice: cardPrice.toFixed(2),
      giftCardAmount: giftCardAmount.toFixed(2),
      subtotal: subtotal.toFixed(2),
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
    console.error('❌ Error calculating price:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Return a default pricing even if calculation fails
    // This ensures the modal can still show and users can proceed
    const defaultPrice = 2.99
    const defaultSubtotal = defaultPrice
    const defaultFee = defaultSubtotal * 0.05
    const defaultTotal = defaultSubtotal + defaultFee
    
    console.log('💰 Returning default pricing due to error')
    
    return NextResponse.json({
      success: true,
      cardPrice: parseFloat(defaultPrice.toFixed(2)),
      giftCardAmount: 0,
      subtotal: parseFloat(defaultSubtotal.toFixed(2)),
      processingFee: parseFloat(defaultFee.toFixed(2)),
      total: parseFloat(defaultTotal.toFixed(2)),
      currency: 'USD',
      breakdown: {
        cardPrice: {
          label: 'Greeting Card',
          amount: parseFloat(defaultPrice.toFixed(2))
        },
        giftCardAmount: null,
        processingFee: {
          label: 'Processing Fee (5%)',
          amount: parseFloat(defaultFee.toFixed(2))
        }
      },
      warning: 'Using default pricing due to calculation error'
    })
  }
}

