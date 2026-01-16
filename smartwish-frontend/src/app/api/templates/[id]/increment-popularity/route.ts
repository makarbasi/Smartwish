import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const apiUrl = new URL(`/api/simple-templates/${templateId}/increment-popularity`, base)

    const response = await fetch(apiUrl.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error incrementing popularity:', error)
    return NextResponse.json(
      { error: 'Failed to increment popularity' },
      { status: 500 }
    )
  }
}


