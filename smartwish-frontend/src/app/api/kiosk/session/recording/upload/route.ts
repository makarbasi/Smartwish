import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

/**
 * POST /api/kiosk/session/recording/upload
 * Proxy to backend - Upload recording video or thumbnail to storage
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward the formData to backend
    const response = await fetch(`${BACKEND_URL}/kiosk/session/recording/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Recording] Backend upload error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording] Uploaded via backend:', data.storagePath);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording] Error in upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

