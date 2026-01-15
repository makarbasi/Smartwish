import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * GET /api/gift-cards/lookup
 * Lookup a gift card by code or number
 * Proxies to backend: GET /gift-cards/lookup
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardCode = searchParams.get('cardCode');
    const cardNumber = searchParams.get('cardNumber');

    const url = new URL(`${API_BASE}/gift-cards/lookup`);
    if (cardCode) url.searchParams.set('cardCode', cardCode);
    if (cardNumber) url.searchParams.set('cardNumber', cardNumber);

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Gift card not found' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error looking up gift card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
