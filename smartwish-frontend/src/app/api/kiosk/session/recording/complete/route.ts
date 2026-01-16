import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * POST /api/kiosk/session/recording/complete
 * Proxy to backend - Finalize a recording with all metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Proxy to backend
    const response = await fetch(`${BACKEND_URL}/kiosk/session/recording/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordingId: body.recordingId,
        durationSeconds: body.duration,
        resolution: '1280x720',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Recording] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording] Completed recording via backend:', body.recordingId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording] Error completing recording:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

