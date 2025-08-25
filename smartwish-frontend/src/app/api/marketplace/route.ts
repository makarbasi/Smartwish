import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Redirect all marketplace requests to the new Tremendous API
  try {
    const response = await fetch(`${request.nextUrl.origin}/api/tremendous/products`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Transform to match old marketplace format for backward compatibility
    const marketplaceItems = data.products?.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: `${product.category.replace('_', ' ')} gift card`,
      image: product.image,
      category: product.category === 'merchant_card' ? 'gift-card' :
        product.category === 'charity' ? 'charity' :
          product.category === 'prepaid_card' ? 'membership' : 'other',
      subcategory: product.category,
      price: product.minAmount,
      currency: 'USD',
      available: true,
      tags: [product.category],
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