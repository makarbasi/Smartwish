import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Tillo API configuration
const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://sandbox.tillo.dev/api/v2'

function generateSignature(
  method: string,
  endpoint: string,
  timestamp: number,
  clientRequestId: string = '',
  brandSlug: string = ''
): string {
  // Signature format: API_KEY-METHOD-ENDPOINT-CLIENT_REQUEST_ID-BRAND_SLUG-TIMESTAMP
  // For GET requests without brand, some parts may be empty
  const parts = [TILLO_API_KEY, method.toUpperCase(), endpoint]
  
  if (clientRequestId) {
    parts.push(clientRequestId)
  }
  if (brandSlug) {
    parts.push(brandSlug)
  }
  
  parts.push(timestamp.toString())
  
  const signatureString = parts.join('-')
  
  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  return hmac.digest('hex')
}

export async function GET(request: NextRequest) {
  try {
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
    const endpoint = 'brands'
    const signature = generateSignature('GET', endpoint, timestamp)

    console.log('🔑 Making Tillo API request to:', `${TILLO_BASE_URL}/${endpoint}`)
    console.log('📋 API Key:', TILLO_API_KEY.substring(0, 8) + '...')

    const response = await fetch(`${TILLO_BASE_URL}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': TILLO_API_KEY,
        'Signature': signature,
        'Timestamp': timestamp.toString(),
      },
    })

    const responseText = await response.text()
    console.log('📥 Tillo response status:', response.status)
    
    if (!response.ok) {
      console.error('❌ Tillo API error:', responseText)
      return NextResponse.json(
        { 
          error: 'Failed to fetch brands from Tillo',
          status: response.status,
          details: responseText
        },
        { status: response.status }
      )
    }

    const data = JSON.parse(responseText)
    
    // Log the actual response structure for debugging
    console.log('📦 Tillo Response Structure:', JSON.stringify(data).substring(0, 500))
    console.log('📦 Response keys:', Object.keys(data))
    
    // Tillo API v2 response format:
    // { "code": "000", "status": "success", "message": "...", "data": { "brands": { "brand-slug": {...}, ... } } }
    let brandsObject: Record<string, any> = {}
    
    if (data.data && data.data.brands && typeof data.data.brands === 'object') {
      // Standard Tillo v2 format: data.brands is an object with slugs as keys
      brandsObject = data.data.brands
    } else if (data.brands && typeof data.brands === 'object' && !Array.isArray(data.brands)) {
      // Alternative: brands directly in response
      brandsObject = data.brands
    } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      // Alternative: data itself is the brands object
      brandsObject = data.data
    }
    
    // Convert object to array
    const brandSlugs = Object.keys(brandsObject)
    console.log('📊 Found', brandSlugs.length, 'brands')
    
    if (brandSlugs.length > 0) {
      console.log('📊 Sample brand:', brandSlugs[0], JSON.stringify(brandsObject[brandSlugs[0]]).substring(0, 300))
    }
    
    // Transform the brands data to match our UI needs
    const brands = brandSlugs.map((slug: string) => {
      const brand = brandsObject[slug]
      return {
        id: slug,
        name: brand.name || slug,
        slug: brand.slug || slug,
        logo: brand.logo || brand.logo_url || brand.imageUrl || brand.image || null,
        category: (brand.categories && brand.categories[0]) || brand.category || 'Gift Card',
        minAmount: brand.min_value || brand.minValue || 5,
        maxAmount: brand.max_value || brand.maxValue || 500,
        currency: brand.currency || 'USD',
        type: brand.type || 'gift-card',
        status: brand.status?.code || 'ENABLED',
        deliveryMethods: brand.delivery_methods || ['url'],
        countriesServed: brand.countries_served || ['US']
      }
    })

    console.log(`✅ Successfully processed ${brands.length} brands from Tillo`)

    return NextResponse.json({ 
      brands,
      count: brands.length,
      source: 'tillo'
    })
  } catch (error: any) {
    console.error('❌ Error fetching Tillo brands:', error.message)
    return NextResponse.json(
      { 
        error: 'Failed to fetch brands',
        details: error.message
      },
      { status: 500 }
    )
  }
}

