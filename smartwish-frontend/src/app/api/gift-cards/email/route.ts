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
    const { 
      email, 
      cardNumber, 
      pin, 
      balance, 
      expiresAt, 
      brandName,
      brandLogo,
      redemptionLink,
      source,
      qrCode
    } = body;

    // Validate required fields
    // For Tillo cards: may have redemptionLink instead of cardNumber
    // For SmartWish cards: always have cardNumber
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Must have either cardNumber/code OR redemptionLink
    if (!cardNumber && !redemptionLink) {
      return NextResponse.json(
        { error: 'Card number/code or redemption link is required' },
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
        pin: pin || '',
        balance: balance || 0,
        expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        brandName: brandName || 'Gift Card',
        // New fields for Tillo cards
        brandLogo: brandLogo || '',
        redemptionLink: redemptionLink || '',
        source: source || 'smartwish',
        qrCode: qrCode || '',
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
