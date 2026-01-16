/**
 * Gift Card Encryption API
 * 
 * Server-side encryption endpoint for gift card data
 * Encrypts sensitive data before storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { encryptGiftCardData, maskGiftCardCode, maskRedemptionUrl } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { giftCardData } = body

    if (!giftCardData) {
      return NextResponse.json(
        { error: 'Missing giftCardData in request body' },
        { status: 400 }
      )
    }

    // Encrypt the gift card data
    const encryptedData = encryptGiftCardData(giftCardData)

    // Log masked data for audit trail (never log actual codes)
    console.log('🔐 Gift card data encrypted:', {
      storeName: giftCardData.storeName,
      amount: giftCardData.amount,
      code: giftCardData.code ? maskGiftCardCode(giftCardData.code) : 'N/A',
      url: giftCardData.redemptionLink ? maskRedemptionUrl(giftCardData.redemptionLink) : 'N/A',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      encryptedData,
      message: 'Gift card data encrypted successfully'
    })
  } catch (error: any) {
    console.error('❌ Encryption API error:', error.message)
    return NextResponse.json(
      { 
        error: 'Failed to encrypt gift card data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

