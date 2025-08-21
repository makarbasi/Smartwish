import { NextResponse } from 'next/server'
import axios from 'axios'

const API_KEY = process.env.TREMENDOUS_API_KEY
const BASE_URL = 'https://testflight.tremendous.com/api/v2'

export async function GET() {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'TREMENDOUS_API_KEY not configured' },
        { status: 500 }
      )
    }

    const response = await axios.get(`${BASE_URL}/products`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    // Filter and format products for the UI
    const products = response.data.products
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
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}