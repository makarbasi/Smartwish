import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

/**
 * POST /api/kiosk/session/recording/upload
 * Proxy to backend - Upload recording video or thumbnail to storage
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Log upload attempt
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId');
    const type = formData.get('type') || 'video';
    
    console.log('[Recording Upload API] Upload attempt:', {
      hasFile: !!file,
      fileSize: file?.size || 0,
      fileName: file?.name || 'unknown',
      fileType: file?.type || 'unknown',
      sessionId,
      type,
      backendUrl: BACKEND_URL,
    });

    if (!file) {
      console.error('[Recording Upload API] No file in formData');
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Forward the formData to backend
    console.log('[Recording Upload API] Forwarding to backend...');
    const response = await fetch(`${BACKEND_URL}/kiosk/session/recording/upload`, {
      method: 'POST',
      body: formData,
    });

    console.log('[Recording Upload API] Backend response status:', response.status);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      console.error('[Recording Upload API] Backend response is not JSON:', text);
      return NextResponse.json(
        { error: `Backend error: ${text || response.statusText}` },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error('[Recording Upload API] Backend upload error:', {
        status: response.status,
        error: data.error || data.message || 'Unknown error',
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording Upload API] Upload successful:', {
      storagePath: data.storagePath,
      storageUrl: data.storageUrl ? 'present' : 'missing',
      fileSize: data.fileSize,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording Upload API] Error in upload:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

