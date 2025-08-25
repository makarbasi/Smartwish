import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { productId, amount } = await request.json()

    if (!productId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: productId and amount' },
        { status: 400 }
      )
    }

    // Tremendous API configuration
    const API_KEY = process.env.TREMENDOUS_API_KEY
    const BASE_URL = "https://testflight.tremendous.com/api/v2"

    if (!API_KEY) {
      console.error("❌ TREMENDOUS_API_KEY not found in environment variables")
      return NextResponse.json(
        { error: 'API configuration missing' },
        { status: 500 }
      )
    }

    // Get funding source
    const fundingResponse = await fetch(`${BASE_URL}/funding_sources`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!fundingResponse.ok) {
      throw new Error(`Failed to fetch funding sources: ${fundingResponse.status}`)
    }

    const fundingData = await fundingResponse.json()
    const fundingSourceId = fundingData.funding_sources[0]?.id

    if (!fundingSourceId) {
      return NextResponse.json(
        { error: 'No funding source available' },
        { status: 500 }
      )
    }

    // Create order with LINK delivery method
    const orderData = {
      payment: {
        funding_source_id: fundingSourceId
      },
      reward: {
        value: {
          denomination: amount,
          currency_code: "USD"
        },
        delivery: {
          method: "LINK"
        },
        recipient: {
          name: "Gift Card Recipient"
        },
        products: [productId]
      }
    }

    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Tremendous API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to create gift card order', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Extract the redemption link from the response
    const redemptionLink = data.order?.rewards?.[0]?.delivery?.link

    if (!redemptionLink) {
      console.error('No redemption link in response:', data)
      return NextResponse.json(
        { error: 'Failed to generate redemption link' },
        { status: 500 }
      )
    }

    // Return the link without PIN
    return NextResponse.json({
      success: true,
      redemptionLink: redemptionLink,
      orderId: data.order?.id,
      amount: amount,
      productName: data.order?.rewards?.[0]?.products?.[0]?.name || 'Gift Card'
    })

  } catch (error) {
    console.error('Error generating gift card:', error)
    return NextResponse.json(
      { error: 'Failed to generate gift card' },
      { status: 500 }
    )
  }
}