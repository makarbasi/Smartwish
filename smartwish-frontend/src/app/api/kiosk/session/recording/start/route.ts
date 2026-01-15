import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * POST /api/kiosk/session/recording/start
 * Proxy to backend - Create a new recording record when session recording begins
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Proxy to backend
    const response = await fetch(`${BACKEND_URL}/kiosk/session/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Recording] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording] Created recording via backend:', data.recordingId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording] Error in recording start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

