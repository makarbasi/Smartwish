import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Price calculation API is working',
    environment: {
      NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'not set',
      NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'not set',
      nodeEnv: process.env.NODE_ENV || 'not set'
    },
    testPricing: {
      cardPrice: 2.99,
      giftCardAmount: 0,
      subtotal: 2.99,
      processingFee: 0.15,
      total: 3.14
    }
  })
}

