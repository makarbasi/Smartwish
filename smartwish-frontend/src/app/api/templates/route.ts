import { NextRequest, NextResponse } from 'next/server'

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

    // If category_id is provided without other filters, use the simple endpoint
    if (categoryId && !query && !region && !language) {
      // Use category-specific endpoint for pure category filtering
      apiUrl = new URL(`/api/simple-templates/category/${categoryId}`, base)
    } else {
      // Use general search endpoint for other queries
      apiUrl = new URL('/templates-enhanced/templates', base)

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
    }

    if (limit) {
      apiUrl.searchParams.set('limit', limit)
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Apply client-side filtering since backend doesn't filter properly
    if (data.data && Array.isArray(data.data)) {
      let filteredData = data.data

      // Filter by region if specified
      if (region && region !== 'Any region') {
        filteredData = filteredData.filter((template: any) =>
          template.region && template.region.toLowerCase() === region.toLowerCase()
        )
      }

      // Filter by language if specified  
      if (language && language !== 'Any language') {
        filteredData = filteredData.filter((template: any) =>
          template.language && template.language.toLowerCase() === language.toLowerCase()
        )
      }

      // Filter by category if specified
      if (categoryId) {
        filteredData = filteredData.filter((template: any) =>
          template.category_id === categoryId
        )
      }

      // Filter by author if specified
      if (author) {
        if (author === 'SmartWish Studio') {
          // SmartWish Studio templates: author_id is null and is_user_generated is false
          filteredData = filteredData.filter((template: any) =>
            template.author_id === null && template.is_user_generated === false
          )
        } else if (author === 'Community') {
          // Community templates: author_id is not null and is_user_generated is true
          filteredData = filteredData.filter((template: any) =>
            template.author_id !== null && template.is_user_generated === true
          )
        }
      }

      // Update the data object with filtered results
      data.data = filteredData
      data.count = filteredData.length
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching templates data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates data' },
      { status: 500 }
    )
  }
}