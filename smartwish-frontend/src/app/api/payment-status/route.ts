import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for payment sessions (in production, use Redis or database)
const paymentSessions = new Map<string, { status: string; timestamp: number }>()

// Clean up old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000)
  for (const [sessionId, data] of paymentSessions.entries()) {
    if (data.timestamp < oneHourAgo) {
      paymentSessions.delete(sessionId)
    }
  }
}, 5 * 60 * 1000) // Clean every 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session')

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  const session = paymentSessions.get(sessionId)
  
  if (!session) {
    return NextResponse.json({
      status: 'pending',
      message: 'Payment not yet completed'
    })
  }

  return NextResponse.json({
    status: session.status,
    timestamp: session.timestamp
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, status } = body

    if (!sessionId || !status) {
      return NextResponse.json(
        { error: 'Session ID and status are required' },
        { status: 400 }
      )
    }

    console.log(`💳 Payment status update: ${sessionId} -> ${status}`)

    paymentSessions.set(sessionId, {
      status,
      timestamp: Date.now()
    })

    return NextResponse.json({
      success: true,
      message: 'Payment status updated'
    })
  } catch (error: any) {
    console.error('Error updating payment status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

