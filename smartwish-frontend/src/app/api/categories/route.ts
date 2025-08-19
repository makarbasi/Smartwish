import { NextResponse } from 'next/server'

export async function GET() {
  try {
  const url = new URL('/templates-enhanced/categories', process.env.NEXT_PUBLIC_API_BASE).toString()
  console.log(url)

  const response = await fetch(url, {
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
    console.error('Error fetching categories data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories data' },
      { status: 500 }
    )
  }
}