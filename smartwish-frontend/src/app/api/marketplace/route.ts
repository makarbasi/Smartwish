import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    
    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'
    let apiUrl: string
    if (query) {
      const u = new URL('/marketplace/search', base)
      u.searchParams.set('q', query)
      apiUrl = u.toString()
    } else {
      apiUrl = new URL('/marketplace', base).toString()
    }

    const response = await fetch(apiUrl, {
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
    console.error('Error fetching marketplace data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch marketplace data' },
      { status: 500 }
    )
  }
}