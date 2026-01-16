import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

/**
 * PATCH /api/kiosk/session/recording/status
 * Proxy to backend - Update the status of a recording
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Proxy to backend
    const response = await fetch(`${BACKEND_URL}/kiosk/session/recording/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Recording] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording] Updated recording status via backend:', body.recordingId, 'to', body.status);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording] Error updating status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

