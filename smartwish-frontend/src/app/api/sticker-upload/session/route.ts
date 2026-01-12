import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  createUploadSession,
  getUploadSession,
  deleteUploadSession,
} from '@/lib/uploadSessionStore'

// POST - Create new upload session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slotIndex, kioskSessionId } = body

    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 5) {
      return NextResponse.json(
        { error: 'Invalid slot index (must be 0-5)' },
        { status: 400 }
      )
    }

    if (!kioskSessionId || typeof kioskSessionId !== 'string') {
      return NextResponse.json(
        { error: 'Kiosk session ID is required' },
        { status: 400 }
      )
    }

    // Generate unique session ID
    const sessionId = randomUUID()

    // Create session
    const session = createUploadSession(sessionId, slotIndex, kioskSessionId)

    // Generate QR code URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const uploadUrl = `${baseUrl}/mobile-upload/${sessionId}`

    return NextResponse.json({
      success: true,
      sessionId,
      uploadUrl,
      expiresAt: session.expiresAt,
      slotIndex
    })
  } catch (error) {
    console.error('Error creating upload session:', error)
    return NextResponse.json(
      { error: 'Failed to create upload session' },
      { status: 500 }
    )
  }
}

// GET - Check session status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = getUploadSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        slotIndex: session.slotIndex,
        status: session.status,
        imageUrl: session.imageUrl,
        imageBase64: session.imageBase64,
        expiresAt: session.expiresAt
      }
    })
  } catch (error) {
    console.error('Error getting session status:', error)
    return NextResponse.json(
      { error: 'Failed to get session status' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel/expire a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const deleted = deleteUploadSession(sessionId)

    return NextResponse.json({
      success: true,
      deleted
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
