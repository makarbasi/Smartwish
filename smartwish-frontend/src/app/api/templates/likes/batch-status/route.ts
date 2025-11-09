import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/templates/likes/batch-status?ids=uuid1,uuid2,uuid3
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids') || '';

    console.log('[frontend] GET /api/templates/likes/batch-status', {
      idsLength: ids.length,
      idsPreview: ids.slice(0, 80),
    });

    if (!ids.trim()) {
      return NextResponse.json({ likesStatus: {} });
    }

    const url = new URL('/api/templates/likes/batch-status', API_BASE_URL);
    url.searchParams.set('ids', ids);

    const targetUrl = url.toString();
    console.log('[frontend] Proxying to backend:', targetUrl);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch like status error:', response.status, errorText);

      // Backend likes controller may be disabled; degrade gracefully
      if (response.status === 404) {
        return NextResponse.json({ likesStatus: {} }, { status: 200 });
      }

      return NextResponse.json(
        { error: 'Failed to fetch batch like status' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching batch like status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



