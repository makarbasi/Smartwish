import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Tremendous API configuration
    const API_KEY = process.env.TREMENDOUS_API_KEY
    const BASE_URL = "https://testflight.tremendous.com/api/v2"

    if (!API_KEY) {
      console.error("❌ TREMENDOUS_API_KEY not found in environment variables")
      return NextResponse.json(
        { error: 'API configuration missing' },
        { status: 500 }
      )
    }

    console.log("🔑 API Key loaded:", API_KEY.substring(0, 10) + "...")

    const response = await fetch(`${BASE_URL}/products`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Filter and format products for the UI
    const products = data.products
      .filter((product: any) =>
        product.currency_codes &&
        product.currency_codes.includes('USD') &&
        product.skus &&
        product.skus.length > 0
      )
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        image: product.images?.find((img: any) => img.type === 'logo')?.src || product.images?.[0]?.src,
        minAmount: Math.min(...product.skus.map((sku: any) => sku.min)),
        maxAmount: Math.max(...product.skus.map((sku: any) => sku.max)),
        availableAmounts: product.skus.map((sku: any) => sku.min).sort((a: number, b: number) => a - b)
      }))
      .slice(0, 50) // Limit to first 50 products for better performance

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}