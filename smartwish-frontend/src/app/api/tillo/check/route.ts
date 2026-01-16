import { NextRequest, NextResponse } from 'next/server'

/**
 * Tillo Configuration Check Endpoint
 * 
 * This endpoint helps diagnose Tillo API configuration issues.
 * Visit: http://localhost:3000/api/tillo/check
 */
export async function GET(request: NextRequest) {
  const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
  const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
  const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2'

  const diagnostics = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    configuration: {
      TILLO_API_KEY: TILLO_API_KEY ? {
        set: true,
        length: TILLO_API_KEY.length,
        preview: TILLO_API_KEY.substring(0, 8) + '...' + TILLO_API_KEY.substring(TILLO_API_KEY.length - 4)
      } : { set: false },
      TILLO_API_SECRET: TILLO_API_SECRET ? {
        set: true,
        length: TILLO_API_SECRET.length,
        preview: TILLO_API_SECRET.substring(0, 8) + '...' + TILLO_API_SECRET.substring(TILLO_API_SECRET.length - 4)
      } : { set: false },
      TILLO_BASE_URL: {
        set: true,
        value: TILLO_BASE_URL
      }
    },
    instructions: [] as string[],
    nextSteps: [] as string[]
  }

  // Check what's missing
  if (!TILLO_API_KEY) {
    diagnostics.instructions.push(
      '❌ TILLO_API_KEY is not set.',
      '   → Go to Tillo Hub (https://hub.sandbox.tillo.dev/)',
      '   → Navigate to API Admin section',
      '   → Create or find your API Key',
      '   → Add to .env.local: TILLO_API_KEY=your-api-key'
    )
  }

  if (!TILLO_API_SECRET) {
    diagnostics.instructions.push(
      '❌ TILLO_API_SECRET is not set.',
      '   → The secret is the key you provided: 6e9cf0f6549bef4c5ad5eeb17fb32b7c08bc0ab8154bb905cff625d9470588b8',
      '   → Add to .env.local: TILLO_API_SECRET=6e9cf0f6549bef4c5ad5eeb17fb32b7c08bc0ab8154bb905cff625d9470588b8'
    )
  }

  if (TILLO_API_KEY && TILLO_API_SECRET) {
    diagnostics.status = 'configured'
    diagnostics.nextSteps.push(
      '✅ Both API Key and Secret are configured!',
      '→ Visit /api/tillo/test to test the connection',
      '→ Visit /api/tillo/brands to fetch available brands'
    )
  } else {
    diagnostics.status = 'incomplete'
    diagnostics.nextSteps.push(
      '1. Add the missing environment variables to .env.local',
      '2. Restart the Next.js development server',
      '3. Visit this endpoint again to verify',
      '',
      '📌 IMPORTANT: You need BOTH an API Key AND an API Secret from Tillo.',
      '   The key you provided looks like the Secret.',
      '   You still need the API Key from Tillo Hub.'
    )
  }

  return NextResponse.json(diagnostics, { 
    status: TILLO_API_KEY && TILLO_API_SECRET ? 200 : 500 
  })
}

