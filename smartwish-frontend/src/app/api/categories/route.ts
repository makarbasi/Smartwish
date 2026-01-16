import { NextResponse } from 'next/server'

// Cache categories for 5 minutes - they don't change often
export const revalidate = 300

export async function GET() {
  try {
    const url = new URL('/templates-enhanced/categories', process.env.NEXT_PUBLIC_API_BASE).toString()

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache on the server side for 5 minutes
      next: { revalidate: 300 }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Return with cache headers for client-side caching
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Error fetching categories data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories data' },
      { status: 500 }
    )
  }
}