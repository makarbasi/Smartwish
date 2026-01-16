import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Tillo API configuration
const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2'

// Generate signature for GET requests (brands endpoint)
// Format: apikey-METHOD-endpoint-timestamp
function generateSignature(
  method: string,
  endpoint: string,
  timestamp: number
): { signature: string, signatureString: string } {
  // Tillo signature format for GET: API_KEY-METHOD-ENDPOINT-TIMESTAMP
  const signatureString = [
    TILLO_API_KEY,
    method.toUpperCase(),
    endpoint,
    timestamp.toString()
  ].join('-')

  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  const signature = hmac.digest('hex')
  
  return { signature, signatureString }
}

export async function GET(request: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      hasApiKey: !!TILLO_API_KEY,
      apiKeyLength: TILLO_API_KEY.length,
      apiKeyPrefix: TILLO_API_KEY.substring(0, 8) + '...',
      hasApiSecret: !!TILLO_API_SECRET,
      apiSecretLength: TILLO_API_SECRET.length,
      baseUrl: TILLO_BASE_URL
    }
  }

  // Check if credentials are configured
  if (!TILLO_API_KEY) {
    diagnostics.error = 'TILLO_API_KEY is not set'
    diagnostics.hint = 'Add TILLO_API_KEY to your .env.local file'
    return NextResponse.json(diagnostics, { status: 500 })
  }

  if (!TILLO_API_SECRET) {
    diagnostics.error = 'TILLO_API_SECRET is not set'
    diagnostics.hint = 'Add TILLO_API_SECRET to your .env.local file'
    return NextResponse.json(diagnostics, { status: 500 })
  }

  // Test the API connection
  try {
    const timestamp = Date.now()
    const endpoint = 'brands'
    const { signature, signatureString } = generateSignature('GET', endpoint, timestamp)

    diagnostics.request = {
      url: `${TILLO_BASE_URL}/${endpoint}`,
      method: 'GET',
      timestamp,
      signatureString: signatureString.substring(0, 30) + '...' + signatureString.substring(signatureString.length - 20),
      signaturePreview: signature.substring(0, 16) + '...',
      headers: {
        'API-Key': TILLO_API_KEY.substring(0, 8) + '...',
        'Timestamp': timestamp.toString()
      }
    }

    console.log('🔐 Tillo API Request Debug:')
    console.log('  URL:', `${TILLO_BASE_URL}/${endpoint}`)
    console.log('  Signature String (first 50 chars):', signatureString.substring(0, 50) + '...')
    console.log('  Generated Signature:', signature)

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
    
    diagnostics.response = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    }

    if (response.ok) {
      const data = JSON.parse(responseText)
      const brandCount = (data.brands || data.data || []).length
      
      diagnostics.success = true
      diagnostics.message = `✅ Tillo API connection successful! Found ${brandCount} brands.`
      diagnostics.sampleBrands = (data.brands || data.data || []).slice(0, 3).map((b: any) => ({
        name: b.name || b.brandName,
        slug: b.slug
      }))
      
      return NextResponse.json(diagnostics)
    } else {
      diagnostics.success = false
      diagnostics.error = 'API request failed'
      diagnostics.responseBody = responseText.substring(0, 500)
      
      // Parse common error scenarios
      if (response.status === 401) {
        diagnostics.hint = 'Authentication failed. This could mean: 1) API Key or Secret is incorrect, 2) Signature generation is wrong, 3) IP not whitelisted. Check Tillo Hub → API Admin.'
        // Try to parse error details
        try {
          const errorData = JSON.parse(responseText)
          diagnostics.errorDetails = errorData
        } catch {}
      } else if (response.status === 403) {
        diagnostics.hint = 'Access forbidden. Your IP address needs to be whitelisted in Tillo Hub → API Admin → IP Whitelist.'
      } else if (response.status === 404) {
        diagnostics.hint = 'Endpoint not found. Check TILLO_BASE_URL configuration.'
      }
      
      return NextResponse.json(diagnostics, { status: response.status })
    }
  } catch (error: any) {
    diagnostics.success = false
    diagnostics.error = error.message
    diagnostics.stack = error.stack?.split('\n').slice(0, 5)
    
    if (error.message.includes('fetch')) {
      diagnostics.hint = 'Network error. Check if the Tillo API URL is correct and accessible.'
    }
    
    return NextResponse.json(diagnostics, { status: 500 })
  }
}

