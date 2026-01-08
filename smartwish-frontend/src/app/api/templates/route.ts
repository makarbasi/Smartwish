import { NextRequest, NextResponse } from 'next/server'

// Cache template searches for 1 minute
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const region = searchParams.get('region')
    const language = searchParams.get('language')
    const categoryId = searchParams.get('category_id')
    const author = searchParams.get('author')
    const limit = searchParams.get('limit')

    let apiUrl: URL

    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'

    // If category_id is provided without other filters (except author), use the simple endpoint
    if (categoryId && !query && !region && !language && !author) {
      // Use category-specific endpoint for pure category filtering
      apiUrl = new URL(`/api/simple-templates/category/${categoryId}`, base)
    } else {
      // Use enhanced search endpoint for all other cases (including no parameters)
      apiUrl = new URL('/templates-enhanced/templates/search', base)

      if (query) {
        apiUrl.searchParams.set('q', query)
      }
      if (region && region !== 'Any region') {
        apiUrl.searchParams.set('region', region)
      }
      if (language && language !== 'Any language') {
        apiUrl.searchParams.set('language', language)
      }
      if (categoryId) {
        apiUrl.searchParams.set('category_id', categoryId)
      }
      if (author) {
        apiUrl.searchParams.set('author', author)
      }
    }

    if (limit) {
      apiUrl.searchParams.set('limit', limit)
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 1 minute
      next: { revalidate: 60 }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Safely parse upstream response as JSON
    const contentType = response.headers.get('content-type') || ''
    let data: any
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (e) {
        // Upstream returned invalid JSON
        const text = await response.text().catch(() => '')
        console.error('Upstream templates API returned invalid JSON. Sample:', text?.slice(0, 200))
        throw new Error('Invalid JSON from upstream templates API')
      }
    } else {
      // Non-JSON response; log sample and fail gracefully
      const text = await response.text().catch(() => '')
      console.error('Upstream templates API returned non-JSON response. Sample:', text?.slice(0, 200))
      throw new Error('Non-JSON response from upstream templates API')
    }

    // Backend now handles all filtering, no need for client-side filtering
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching templates data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates data' },
      { status: 500 }
    )
  }
}