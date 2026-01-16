import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Redirect all marketplace requests to the Tillo brands API
  try {
    const response = await fetch(`${request.nextUrl.origin}/api/tillo/brands`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Transform to match old marketplace format for backward compatibility
    const marketplaceItems = data.brands?.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      description: `${brand.category} gift card`,
      image: brand.logo,
      category: brand.category || 'gift-card',
      subcategory: brand.type || 'gift-card',
      price: brand.minAmount,
      currency: brand.currency || 'USD',
      available: brand.status === 'ENABLED',
      tags: [brand.category],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) || []

    return NextResponse.json(marketplaceItems)
  } catch (error) {
    console.error('Error fetching marketplace data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch marketplace data' },
      { status: 500 }
    )
  }
}
