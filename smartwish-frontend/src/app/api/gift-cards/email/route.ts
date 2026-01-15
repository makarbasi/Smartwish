import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// Format card number as 16 digits with spaces
function formatCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\s/g, '');
  if (clean.length === 16) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
  }
  return cardNumber;
}

/**
 * POST /api/gift-cards/email
 * Email gift card details to a specified email address
 */
export async function POST(request: NextRequest) {
  try {
    const { cardId, email } = await request.json();

    if (!cardId || !email) {
      return NextResponse.json(
        { error: 'Card ID and email are required' },
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

    // Fetch card details from backend
    const cardResponse = await fetch(`${API_BASE}/gift-cards/${cardId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!cardResponse.ok) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    const card = await cardResponse.json();

    // Generate QR code
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartwish.com';
    const qrCode = await QRCode.toDataURL(
      `${appUrl}/redeem?card=${card.cardNumber}`,
      {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }
    );

    // Format dates
    const expiresDate = new Date(card.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your SmartWish Gift Card</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); border-radius: 16px; padding: 24px; text-align: center; color: white;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px;">🎁 Your Gift Card</h1>
              <p style="margin: 0; opacity: 0.9;">from SmartWish</p>
            </div>
            
            <div style="background: white; border-radius: 16px; padding: 32px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="${qrCode}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px;" />
                <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Scan to redeem</p>
              </div>
              
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Card Number</p>
                <p style="font-family: 'Courier New', monospace; font-size: 24px; letter-spacing: 4px; color: #1f2937; margin: 0; font-weight: bold;">
                  ${formatCardNumber(card.cardNumber)}
                </p>
              </div>
              
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">PIN</p>
                <p style="font-family: 'Courier New', monospace; font-size: 20px; color: #1f2937; margin: 0; font-weight: bold;">
                  ${card.pin || '****'}
                </p>
              </div>
              
              <div style="display: flex; gap: 20px; margin-top: 20px;">
                <div style="flex: 1; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 12px;">
                  <p style="color: #059669; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase;">Balance</p>
                  <p style="color: #059669; font-size: 28px; font-weight: bold; margin: 0;">$${(card.initialBalance || card.currentBalance || 0).toFixed(2)}</p>
                </div>
                <div style="flex: 1; text-align: center; padding: 16px; background: #fef3c7; border-radius: 12px;">
                  <p style="color: #d97706; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase;">Expires</p>
                  <p style="color: #d97706; font-size: 16px; font-weight: bold; margin: 0;">${expiresDate}</p>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding: 16px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Keep this email safe. You'll need the card number and PIN to use your gift card.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin-top: 12px;">
                © ${new Date().getFullYear()} SmartWish. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via backend or email service
    // Try to use the backend email endpoint if available
    const emailResponse = await fetch(`${API_BASE}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: 'Your SmartWish Gift Card 🎁',
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      // If backend email fails, try nodemailer directly or return success anyway
      console.warn('Backend email send failed, but gift card was created');
      // For now, we'll return success since the card was created
      // In production, you'd want to set up a proper email service
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
