import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
    }

    const response = await fetch(
      `${API_BASE_URL}/api/templates/likes/batch-status?ids=${encodeURIComponent(ids)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch like status error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch like status' },
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



