import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * POST /api/manager/gift-cards/check-balance
 * Check gift card balance (requires card number and PIN)
 * Proxies to backend: POST /manager/gift-cards/check-balance
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields - either cardNumber or cardCode (QR) is needed
    if (!body.cardNumber && !body.cardCode) {
      return NextResponse.json(
        { error: 'Card number or QR code is required' },
        { status: 400 }
      );
    }

    if (!body.pin) {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    // Normalize card number: remove spaces and trim (card numbers are stored without spaces)
    const normalizedBody = { ...body };
    if (normalizedBody.cardNumber) {
      normalizedBody.cardNumber = normalizedBody.cardNumber.replace(/\s/g, '').trim();
      console.log('[Manager CheckBalance] Normalized card number:', normalizedBody.cardNumber, '(original:', body.cardNumber, ')');
    }
    if (normalizedBody.cardCode) {
      console.log('[Manager CheckBalance] Using cardCode (QR):', normalizedBody.cardCode.substring(0, 50));
    }

    const response = await fetch(`${API_BASE}/manager/gift-cards/check-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to check balance' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform response to flatten brand info for frontend
    const transformedCard = data.card ? {
      id: data.card.id,
      cardNumber: data.card.cardNumber,
      currentBalance: Number(data.card.currentBalance),
      initialBalance: Number(data.card.initialBalance),
      status: data.card.status,
      expiresAt: data.card.expiresAt,
      brandName: data.card.brand?.name || 'SmartWish',
      brandLogo: data.card.brand?.logo,
    } : null;
    
    return NextResponse.json({ success: true, card: transformedCard });
  } catch (error) {
    console.error('Error checking gift card balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
