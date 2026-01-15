import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * POST /api/gift-cards/email
 * Email gift card details to a specified email address
 * Proxies to backend which handles the actual email sending
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, cardNumber, pin, balance, expiresAt, brandName } = body;

    // Validate required fields
    if (!email || !cardNumber || !pin) {
      return NextResponse.json(
        { error: 'Email, card number, and PIN are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Call backend to send the email
    const response = await fetch(`${API_BASE}/gift-cards/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        cardNumber,
        pin,
        balance: balance || 0,
        expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        brandName: brandName || 'Gift Card',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Backend email send failed:', data.error);
      return NextResponse.json(
        { error: data.error || 'Failed to send email' },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Gift card details sent to email',
    });
  } catch (error) {
    console.error('Error emailing gift card:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
