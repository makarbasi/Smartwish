import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// Transform backend camelCase to frontend snake_case
function transformBrandToSnakeCase(brand: any) {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logo_url: brand.logoUrl,
    min_amount: brand.minAmount,
    max_amount: brand.maxAmount,
    min_redemption_amount: 0.01, // Default value
    expiry_months: brand.expiryMonths,
    is_smartwish_brand: brand.isSmartWishBrand,
    is_promoted: brand.isPromoted,
    is_active: brand.isActive,
    created_at: brand.createdAt,
    updated_at: brand.updatedAt,
  };
}

/**
 * GET /api/admin/gift-card-brands
 * List all gift card brands (including inactive)
 * Proxies to backend: GET /admin/gift-card-brands
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive');

    const url = new URL(`${API_BASE}/admin/gift-card-brands`);
    if (includeInactive) url.searchParams.set('includeInactive', includeInactive);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch brands' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend returns { brands, count } - transform to { data } for frontend
    const brands = data.brands || data.data || [];
    const transformedData = {
      data: Array.isArray(brands) 
        ? brands.map(transformBrandToSnakeCase)
        : [],
      count: data.count || brands.length,
    };
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching gift card brands:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/gift-card-brands
 * Create a new gift card brand
 * Proxies to backend: POST /admin/gift-card-brands
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/gift-card-brands`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to create brand' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend returns { success, brand } - transform for frontend
    const brand = data.brand || data.data;
    const transformedData = {
      success: data.success,
      data: brand ? transformBrandToSnakeCase(brand) : null,
    };
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error creating gift card brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
