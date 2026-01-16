import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const templateId = resolvedParams.id
    const body = await request.json()
    
    const { 
      pageImages, 
      action = 'update', // 'update' or 'duplicate'
      title,
      userId 
    } = body

    if (!pageImages || !Array.isArray(pageImages)) {
      return NextResponse.json(
        { error: 'Page images are required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'
    
    if (action === 'duplicate') {
      // For duplicating, call the backend duplicate endpoint
      const response = await fetch(`${base}/api/simple-templates/duplicate/${templateId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || `Copy of Template ${templateId}`,
          image_1: pageImages[0] || '',
          image_2: pageImages[1] || pageImages[0] || '',
          image_3: pageImages[2] || pageImages[0] || '',
          image_4: pageImages[3] || pageImages[0] || '',
          user_id: userId
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend duplicate error:', errorText)
        throw new Error(`Failed to duplicate template: ${response.status}`)
      }

      const result = await response.json()
      
      return NextResponse.json({
        success: result.success || true,
        message: result.message || 'Template duplicated successfully',
        data: result.data,
        action: 'duplicate'
      })
    } else {
      // For updating, call the backend update endpoint
      const response = await fetch(`${base}/api/simple-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_1: pageImages[0] || '',
          image_2: pageImages[1] || pageImages[0] || '',
          image_3: pageImages[2] || pageImages[0] || '',
          image_4: pageImages[3] || pageImages[0] || '',
          title: title,
          description: `Updated on ${new Date().toLocaleDateString()}`
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend update error:', errorText)
        throw new Error(`Failed to update template: ${response.status}`)
      }

      const result = await response.json()
      
      return NextResponse.json({
        success: result.success || true,
        message: result.message || 'Template updated successfully',
        data: result.data,
        action: 'update'
      })
    }
  } catch (error) {
    console.error('Error saving template:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
