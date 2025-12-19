import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Generate UUID without external dependency
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Tillo API configuration
const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://sandbox.tillo.dev/api/v2'

function generateSignature(
  method: string,
  endpoint: string,
  timestamp: number,
  clientRequestId: string,
  brandSlug: string
): string {
  // Signature format: API_KEY-METHOD-ENDPOINT-CLIENT_REQUEST_ID-BRAND-TIMESTAMP
  const signatureString = [
    TILLO_API_KEY,
    method.toUpperCase(),
    endpoint,
    clientRequestId,
    brandSlug,
    timestamp.toString()
  ].join('-')
  
  console.log('🔏 Signature string:', signatureString)

  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  return hmac.digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandSlug, amount, currency = 'USD' } = body
    // Use sector from request, env var, or default
    const sector = body.sector || process.env.TILLO_DEFAULT_SECTOR || 'b2c-marketplace'

    if (!brandSlug || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: brandSlug and amount' },
        { status: 400 }
      )
    }

    if (!TILLO_API_KEY || !TILLO_API_SECRET) {
      console.error('❌ Tillo API credentials not configured')
      return NextResponse.json(
        { 
          error: 'Tillo API configuration missing',
          details: 'Please set TILLO_API_KEY and TILLO_API_SECRET environment variables'
        },
        { status: 500 }
      )
    }

    const timestamp = Date.now()
    const clientRequestId = generateUUID()
    const amountValue = parseFloat(amount)
    
    // Tillo API v2 endpoint for digital gift card issuance
    const endpoint = 'digital/issue'
    const signatureEndpoint = 'digital-issue'  // Signature uses the action name
    const signature = generateSignature('POST', signatureEndpoint, timestamp, clientRequestId, brandSlug)

    console.log('🎁 Issuing Tillo gift card:', { brandSlug, amount, currency })
    console.log('📋 Client Request ID:', clientRequestId)

    // Tillo API v2 request body format
    // According to Tillo docs, these are the required fields for digital/issue
    const requestBody = {
      brand: brandSlug,
      face_value: amountValue,
      currency: currency,
      client_request_id: clientRequestId,
      sector: sector,
      delivery_method: 'url'
    }

    console.log('📤 Tillo issue request:', JSON.stringify(requestBody))
    console.log('🔐 Signature endpoint:', signatureEndpoint)
    console.log('🌐 Full URL:', `${TILLO_BASE_URL}/${endpoint}`)

    const response = await fetch(`${TILLO_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': TILLO_API_KEY,
        'Signature': signature,
        'Timestamp': timestamp.toString(),
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log('📥 Tillo issue response status:', response.status)
    
    if (!response.ok) {
      console.error('❌ Tillo issue error:', responseText)
      return NextResponse.json(
        { 
          error: 'Failed to issue gift card',
          status: response.status,
          details: responseText
        },
        { status: response.status }
      )
    }

    const data = JSON.parse(responseText)
    console.log('📦 Tillo issue response:', JSON.stringify(data).substring(0, 500))
    
    // Tillo v2 response format: { code, status, message, data: { ... } }
    const responseData = data.data || data
    
    // Extract the gift card details from response
    const giftCard = {
      orderId: responseData.order_id || responseData.orderId || responseData.id || clientRequestId,
      clientRequestId,
      brandSlug,
      amount: parseFloat(amount),
      currency,
      // Voucher details
      code: responseData.voucher_code || responseData.code || responseData.voucherCode,
      pin: responseData.voucher_pin || responseData.pin || responseData.voucherPin,
      // Redemption URL
      url: responseData.url || responseData.redemption_url || responseData.redemptionUrl || responseData.claim_url,
      // Expiry
      expiryDate: responseData.expiry_date || responseData.expiryDate || responseData.valid_until,
      // Visual elements
      barcode: responseData.barcode || responseData.barcode_url,
      qrCode: responseData.qr_code || responseData.qrCode,
      // Status
      status: data.status || responseData.status || 'issued',
      issuedAt: new Date().toISOString(),
      // Raw response for debugging
      rawResponse: responseData
    }

    console.log('✅ Successfully issued gift card:', giftCard.orderId)
    console.log('🔗 Redemption URL:', giftCard.url)

    return NextResponse.json({ 
      success: true,
      giftCard,
      source: 'tillo'
    })
  } catch (error: any) {
    console.error('❌ Error issuing Tillo gift card:', error.message)
    return NextResponse.json(
      { 
        error: 'Failed to issue gift card',
        details: error.message
      },
      { status: 500 }
    )
  }
}

