import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      images,  // Array of base64 image data
      userId,
      designId
    } = body

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Images array is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Generate a design ID if not provided
    const finalDesignId = designId || `template_${Date.now()}`

    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'
    
    // Upload images to cloud storage using the existing backend endpoint
    const response = await fetch(`${base}/save-images-cloud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images,
        userId,
        designId: finalDesignId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend upload error:', errorText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Images uploaded successfully',
      cloudUrls: result.cloudUrls,
      designId: finalDesignId,
      count: result.count
    })
  } catch (error) {
    console.error('Error uploading images:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
