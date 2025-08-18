import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') || '4'
    
  const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'

  // First, fetch categories
  const categoriesUrl = new URL('/templates-enhanced/categories', base).toString()
  const categoriesResponse = await fetch(categoriesUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!categoriesResponse.ok) {
      throw new Error(`HTTP error! status: ${categoriesResponse.status}`)
    }

    const categoriesData = await categoriesResponse.json()
    const categories = categoriesData.data || []
    
    // Fetch templates for each category
    const categoryTemplates = await Promise.all(
      categories.map(async (category: any) => {
        try {
          const apiUrl = new URL('/templates-enhanced/templates', base)
          apiUrl.searchParams.set('category_id', category.id)
          apiUrl.searchParams.set('limit', limit)
          
          const response = await fetch(apiUrl.toString(), {
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            console.warn(`Failed to fetch templates for category ${category.id}`)
            return {
              category,
              templates: []
            }
          }

          const data = await response.json()
          return {
            category,
            templates: data.data || []
          }
        } catch (error) {
          console.warn(`Error fetching templates for category ${category.id}:`, error)
          return {
            category,
            templates: []
          }
        }
      })
    )
    
    // Filter out categories with no templates
    const validCategoryTemplates = categoryTemplates.filter(item => item.templates.length > 0)
    
    return NextResponse.json({
      success: true,
      data: validCategoryTemplates,
      count: validCategoryTemplates.length
    })
  } catch (error) {
    console.error('Error fetching category templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category templates' },
      { status: 500 }
    )
  }
}