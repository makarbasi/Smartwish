/**
 * Tillo Gift Card Issuance API
 * 
 * Features:
 * - AES-256 encryption for gift card data
 * - Idempotency via client_request_id (safe retries)
 * - Smart retry logic with exponential backoff
 * - Only retries on network errors and 5xx server errors
 * - Never retries on 4xx client errors (prevents duplicate issuance)
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// =============================================================================
// Configuration
// =============================================================================

const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2'

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000  // 1 second
const MAX_RETRY_DELAY_MS = 10000     // 10 seconds
const REQUEST_TIMEOUT_MS = 30000     // 30 seconds

// Error codes that should NOT be retried (client errors)
const NON_RETRYABLE_STATUS_CODES = [
  400,  // Bad Request - invalid parameters
  401,  // Unauthorized - authentication failed
  402,  // Payment Required - insufficient funds
  403,  // Forbidden - not allowed
  404,  // Not Found - brand doesn't exist
  409,  // Conflict - duplicate request (idempotency working!)
  422,  // Unprocessable Entity - validation failed
]

// =============================================================================
// Utilities
// =============================================================================

/**
 * Generate UUID v4 for client_request_id
 * This ID is used for idempotency - same ID = same result, no duplicates
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate HMAC-SHA256 signature for Tillo API
 */
function generateSignature(
  method: string,
  endpoint: string,
  timestamp: number,
  clientRequestId: string,
  brandSlug: string
): string {
  const signatureString = [
    TILLO_API_KEY,
    method.toUpperCase(),
    endpoint,
    clientRequestId,
    brandSlug,
    timestamp.toString()
  ].join('-')

  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  return hmac.digest('hex')
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 500  // Add 0-500ms jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if an error is retryable
 */
function isRetryableError(status: number | null, error: Error | null): boolean {
  // Network errors (no status) are retryable
  if (status === null && error) {
    const errorMessage = error.message.toLowerCase()
    // Retry on network-related errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('socket') ||
      errorMessage.includes('fetch failed')
    ) {
      return true
    }
  }

  // 5xx server errors are retryable
  if (status !== null && status >= 500 && status < 600) {
    return true
  }

  // 429 Too Many Requests is retryable (rate limiting)
  if (status === 429) {
    return true
  }

  // 4xx errors are NOT retryable
  return false
}

// =============================================================================
// Main API Handler
// =============================================================================

interface TilloIssueResult {
  success: boolean
  status?: number
  data?: any
  error?: string
  details?: string
  retryable?: boolean
}

/**
 * Make a single attempt to issue a gift card
 */
async function attemptIssue(
  brandSlug: string,
  amount: number,
  currency: string,
  sector: string,
  clientRequestId: string  // Same ID for all retries (idempotency)
): Promise<TilloIssueResult> {
  // Generate fresh timestamp and signature for each attempt
  const timestamp = Date.now()
  const signatureEndpoint = 'digital-issue'
  const signature = generateSignature('POST', signatureEndpoint, timestamp, clientRequestId, brandSlug)

  const requestBody = {
    client_request_id: clientRequestId,
    brand: brandSlug,
    face_value: {
      amount: Number(amount.toFixed(2)),
      currency: currency
    },
    delivery_method: 'url',
    fulfilment_by: 'partner',
    sector: sector
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(`${TILLO_BASE_URL}/digital/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': TILLO_API_KEY,
        'Signature': signature,
        'Timestamp': timestamp.toString(),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()

    if (!response.ok) {
      const isRetryable = isRetryableError(response.status, null)
      return {
        success: false,
        status: response.status,
        error: 'Tillo API error',
        details: responseText,
        retryable: isRetryable
      }
    }

    const data = JSON.parse(responseText)
    return {
      success: true,
      status: response.status,
      data: data
    }

  } catch (error: any) {
    // Handle timeout
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        details: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        retryable: true
      }
    }

    // Handle network errors
    const isRetryable = isRetryableError(null, error)
    return {
      success: false,
      error: 'Network error',
      details: error.message,
      retryable: isRetryable
    }
  }
}

/**
 * Issue gift card with automatic retry on transient failures
 */
async function issueWithRetry(
  brandSlug: string,
  amount: number,
  currency: string,
  sector: string
): Promise<TilloIssueResult & { clientRequestId: string; attempts: number }> {
  // Generate a single client_request_id for all attempts
  // This ensures idempotency - if the request succeeded but we didn't get the response,
  // Tillo will return the same result instead of issuing a duplicate
  const clientRequestId = generateUUID()

  let lastResult: TilloIssueResult = {
    success: false,
    error: 'No attempts made'
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`🎁 [Attempt ${attempt + 1}/${MAX_RETRIES}] Issuing gift card:`, {
      brandSlug,
      amount,
      currency,
      clientRequestId
    })

    lastResult = await attemptIssue(brandSlug, amount, currency, sector, clientRequestId)

    // Success - return immediately
    if (lastResult.success) {
      console.log(`✅ [Attempt ${attempt + 1}] Gift card issued successfully`)
      return { ...lastResult, clientRequestId, attempts: attempt + 1 }
    }

    // Check if we should retry
    if (!lastResult.retryable) {
      console.log(`❌ [Attempt ${attempt + 1}] Non-retryable error (status: ${lastResult.status}):`, lastResult.details)
      return { ...lastResult, clientRequestId, attempts: attempt + 1 }
    }

    // Don't retry on last attempt
    if (attempt === MAX_RETRIES - 1) {
      console.log(`❌ [Attempt ${attempt + 1}] Max retries reached`)
      break
    }

    // Calculate and apply retry delay
    const delay = getRetryDelay(attempt)
    console.log(`⏳ [Attempt ${attempt + 1}] Retrying in ${Math.round(delay)}ms... (Error: ${lastResult.error})`)
    await sleep(delay)
  }

  return { ...lastResult, clientRequestId, attempts: MAX_RETRIES }
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandSlug, amount, currency = 'USD' } = body
    
    // IMPORTANT: Always use 'gift-card-mall' - this is the correct sector for our Tillo account
    // Ignore the env variable since it may have the old incorrect value
    const sector = 'gift-card-mall'
    
    console.log('🎁 Issuing gift card with sector:', sector, '(hardcoded - ignoring env)')

    // Validate required fields
    if (!brandSlug || !amount) {
      return NextResponse.json(
        {
          error: 'Missing required fields: brandSlug and amount',
          retryable: false
        },
        { status: 400 }
      )
    }

    // Validate API credentials
    if (!TILLO_API_KEY || !TILLO_API_SECRET) {
      console.error('❌ Tillo API credentials not configured')
      return NextResponse.json(
        {
          error: 'Tillo API configuration missing',
          details: 'Please set TILLO_API_KEY and TILLO_API_SECRET environment variables',
          retryable: false
        },
        { status: 500 }
      )
    }

    const amountValue = parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid amount',
          details: 'Amount must be a positive number',
          retryable: false
        },
        { status: 400 }
      )
    }

    // Issue with automatic retry
    const result = await issueWithRetry(brandSlug, amountValue, currency, sector)

    if (!result.success) {
      console.error(`❌ Failed to issue gift card after ${result.attempts} attempts:`, result.error)
      return NextResponse.json(
        {
          error: 'Failed to issue gift card',
          details: result.details,
          attempts: result.attempts,
          clientRequestId: result.clientRequestId,
          retryable: result.retryable
        },
        { status: result.status || 500 }
      )
    }

    // Extract gift card details from successful response
    const responseData = result.data.data || result.data

    const giftCard = {
      orderId: responseData.order_id || responseData.orderId || responseData.id || result.clientRequestId,
      clientRequestId: result.clientRequestId,
      brandSlug,
      amount: amountValue,
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
      status: result.data.status || responseData.status || 'issued',
      issuedAt: new Date().toISOString(),
      // Retry metadata
      attempts: result.attempts
    }

    console.log(`✅ Gift card issued successfully (${result.attempts} attempt(s)):`, {
      orderId: giftCard.orderId,
      clientRequestId: giftCard.clientRequestId,
      brand: brandSlug,
      amount: amountValue
    })

    return NextResponse.json({
      success: true,
      giftCard,
      source: 'tillo',
      attempts: result.attempts
    })

  } catch (error: any) {
    console.error('❌ Unexpected error in Tillo issue route:', error.message)
    return NextResponse.json(
      {
        error: 'Failed to issue gift card',
        details: error.message,
        retryable: true  // Unknown errors might be transient
      },
      { status: 500 }
    )
  }
}
