import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const kioskId = searchParams.get('kioskId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const params = new URLSearchParams();
    if (kioskId) params.append('kioskId', kioskId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    const response = await fetch(
      `${BACKEND_URL}/sales-rep/earnings?${params.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sales rep earnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}
