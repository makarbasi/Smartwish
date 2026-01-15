import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * GET /api/gift-card-brands
 * Public endpoint to fetch active gift card brands for marketplace
 * Proxies to backend: GET /gift-card-brands
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promoted = searchParams.get('promoted');

    const url = new URL(`${API_BASE}/gift-card-brands`);
    if (promoted) url.searchParams.set('promoted', promoted);

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch gift card brands' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform to match frontend expected format
    const brands = (data.brands || []).map((brand: any) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      description: brand.description,
      logo: brand.logoUrl,
      image: brand.logoUrl,
      minAmount: brand.minAmount,
      maxAmount: brand.maxAmount,
      expiryMonths: brand.expiryMonths,
      isSmartWishBrand: brand.isSmartWishBrand,
      isPromoted: brand.isPromoted,
      source: 'smartwish',
      currency: 'USD',
    }));

    return NextResponse.json({
      success: true,
      brands,
      count: brands.length,
    });
  } catch (error) {
    console.error('Error fetching gift card brands:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
