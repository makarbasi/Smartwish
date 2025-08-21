import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const API_KEY = process.env.TREMENDOUS_API_KEY
const BASE_URL = 'https://testflight.tremendous.com/api/v2'

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'TREMENDOUS_API_KEY not configured' },
        { status: 500 }
      )
    }

    const { productId, amount } = await request.json()
    
    if (!productId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get funding source
    const fundingResponse = await axios.get(`${BASE_URL}/funding_sources`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    
    const fundingSourceId = fundingResponse.data.funding_sources[0]?.id
    
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
          currency_code: 'USD'
        },
        delivery: {
          method: 'LINK'
        },
        recipient: {
          name: 'Gift Card Recipient'
        },
        products: [productId]
      }
    }

    const response = await axios.post(
      `${BASE_URL}/orders`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Extract the redemption link from the response
    const redemptionLink = response.data.order?.rewards?.[0]?.delivery?.link
    
    if (!redemptionLink) {
      return NextResponse.json(
        { error: 'Failed to generate redemption link' },
        { status: 500 }
      )
    }

    // Return the link without PIN
    return NextResponse.json({
      success: true,
      redemptionLink: redemptionLink,
      orderId: response.data.order?.id,
      amount: amount,
      productName: response.data.order?.rewards?.[0]?.products?.[0]?.name || 'Gift Card'
    })

  } catch (error: any) {
    console.error('Error generating gift card:', error)
    if (error.response) {
      return NextResponse.json(
        error.response.data,
        { status: error.response.status }
      )
    } else {
      return NextResponse.json(
        { error: 'Failed to generate gift card' },
        { status: 500 }
      )
    }
  }
}