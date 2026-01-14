import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/gift-cards/[id]
 * Get detailed info about a specific gift card including transactions
 * Proxies to backend: GET /admin/gift-cards/:id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/admin/gift-cards/${id}`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Gift card not found' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching gift card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/gift-cards/[id]
 * Update gift card status (void, suspend, etc.)
 * Proxies to backend: PATCH /admin/gift-cards/:id
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/gift-cards/${id}`, {
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
        { error: errorData.message || 'Failed to update gift card' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating gift card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
