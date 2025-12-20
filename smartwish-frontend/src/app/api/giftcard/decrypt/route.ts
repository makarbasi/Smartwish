/**
 * Gift Card Decryption API
 * 
 * Server-side decryption endpoint for gift card data
 * Decrypts data retrieved from storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { decryptGiftCardData, isEncrypted, maskGiftCardCode } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { encryptedData } = body

    if (!encryptedData) {
      return NextResponse.json(
        { error: 'Missing encryptedData in request body' },
        { status: 400 }
      )
    }

    // Check if data is actually encrypted
    if (!isEncrypted(encryptedData)) {
      // Data might be legacy unencrypted - return as-is with warning
      console.warn('⚠️ Received unencrypted gift card data - legacy format')
      try {
        const parsed = JSON.parse(encryptedData)
        return NextResponse.json({
          success: true,
          giftCardData: parsed,
          warning: 'Data was not encrypted (legacy format)'
        })
      } catch {
        return NextResponse.json(
          { error: 'Invalid data format - not encrypted and not valid JSON' },
          { status: 400 }
        )
      }
    }

    // Decrypt the gift card data
    const giftCardData = decryptGiftCardData(encryptedData)

    // Log masked audit trail
    const data = giftCardData as any
    console.log('🔓 Gift card data decrypted:', {
      storeName: data.storeName || 'Unknown',
      amount: data.amount || 'Unknown',
      code: data.code ? maskGiftCardCode(data.code) : 'N/A',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      giftCardData
    })
  } catch (error: any) {
    console.error('❌ Decryption API error:', error.message)
    return NextResponse.json(
      { 
        error: 'Failed to decrypt gift card data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

