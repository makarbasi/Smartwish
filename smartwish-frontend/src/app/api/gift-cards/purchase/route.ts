import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/gift-cards/purchase
 * Purchase a new SmartWish gift card
 * Proxies to backend: POST /gift-cards/purchase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate brandId is a proper UUID (not a session ID)
    if (!body.brandId || !UUID_REGEX.test(body.brandId)) {
      console.error('Invalid brandId:', body.brandId);
      return NextResponse.json(
        { error: `Invalid brand ID format. Expected UUID but got: ${body.brandId?.substring(0, 50) || 'undefined'}` },
        { status: 400 }
      );
    }

    // Validate amount
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE}/gift-cards/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to purchase gift card' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error purchasing gift card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
