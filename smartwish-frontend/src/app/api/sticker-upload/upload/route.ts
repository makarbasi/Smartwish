import { NextRequest, NextResponse } from 'next/server'
import { getUploadSession, updateUploadSession } from '@/lib/uploadSessionStore'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// POST - Handle mobile image upload
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let sessionId: string
    let imageBase64: string

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData upload
      const formData = await request.formData()
      sessionId = formData.get('sessionId') as string
      const file = formData.get('image') as File

      if (!file) {
        return NextResponse.json(
          { error: 'Image file is required' },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 400 }
        )
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
          { status: 400 }
        )
      }

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageBase64 = `data:${file.type};base64,${buffer.toString('base64')}`
    } else {
      // Handle JSON upload (base64)
      const body = await request.json()
      sessionId = body.sessionId
      imageBase64 = body.imageBase64

      if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
        return NextResponse.json(
          { error: 'Valid base64 image data is required' },
          { status: 400 }
        )
      }

      // Check approximate file size from base64
      const base64Size = (imageBase64.length * 3) / 4
      if (base64Size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 400 }
        )
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get and validate session
    const session = getUploadSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired. Please scan the QR code again.' },
        { status: 404 }
      )
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'This upload session has already been used.' },
        { status: 400 }
      )
    }

    if (session.status === 'expired') {
      return NextResponse.json(
        { error: 'This upload session has expired. Please scan a new QR code.' },
        { status: 400 }
      )
    }

    // Update session with uploaded image
    const updated = updateUploadSession(sessionId, {
      status: 'completed',
      imageBase64
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to save upload. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Image uploaded successfully!',
      slotIndex: session.slotIndex
    })
  } catch (error) {
    console.error('Error handling upload:', error)
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    )
  }
}
