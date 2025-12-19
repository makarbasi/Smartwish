import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://sandbox.tillo.dev/api/v2'

function generateSignature(method: string, endpoint: string, timestamp: number): string {
  const signatureString = [TILLO_API_KEY, method.toUpperCase(), endpoint, timestamp.toString()].join('-')
  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  return hmac.digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    // Try to get sectors/account info from Tillo
    const endpoints = ['sectors', 'account', 'me', 'partner', 'partner/sectors']
    const results: Record<string, any> = {}
    
    for (const endpoint of endpoints) {
      const timestamp = Date.now()
      const signature = generateSignature('GET', endpoint, timestamp)
      
      try {
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
        
        const text = await response.text()
        results[endpoint] = {
          status: response.status,
          body: text.substring(0, 500)
        }
      } catch (e: any) {
        results[endpoint] = { error: e.message }
      }
    }
    
    return NextResponse.json({ endpoints: results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

