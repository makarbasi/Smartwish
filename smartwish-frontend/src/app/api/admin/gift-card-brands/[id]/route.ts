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
    min_redemption_amount: 0.01,
    expiry_months: brand.expiryMonths,
    is_smartwish_brand: brand.isSmartWishBrand,
    is_promoted: brand.isPromoted,
    is_active: brand.isActive,
    created_at: brand.createdAt,
    updated_at: brand.updatedAt,
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/gift-card-brands/[id]
 * Get a single gift card brand
 * Proxies to backend: GET /admin/gift-card-brands/:id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/admin/gift-card-brands/${id}`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Brand not found' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend returns { brand } - transform for frontend
    const brand = data.brand || data.data;
    const transformedData = {
      success: true,
      data: brand ? transformBrandToSnakeCase(brand) : null,
    };
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching gift card brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/gift-card-brands/[id]
 * Update a gift card brand
 * Proxies to backend: PATCH /admin/gift-card-brands/:id
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/gift-card-brands/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to update brand' },
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
    console.error('Error updating gift card brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/gift-card-brands/[id]
 * Delete/deactivate a gift card brand
 * Proxies to backend: DELETE /admin/gift-card-brands/:id
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/admin/gift-card-brands/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to delete brand' },
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
    console.error('Error deleting gift card brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
