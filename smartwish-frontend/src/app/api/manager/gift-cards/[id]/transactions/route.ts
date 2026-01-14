import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/gift-cards/[id]/transactions
 * Get transaction history for a gift card
 * Proxies to backend: GET /manager/gift-cards/:id/transactions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/manager/gift-cards/${id}/transactions`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch transactions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching gift card transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
