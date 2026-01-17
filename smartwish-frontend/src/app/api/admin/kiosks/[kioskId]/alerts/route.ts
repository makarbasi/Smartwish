import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// GET /api/admin/kiosks/[kioskId]/alerts - Get all alerts for a kiosk
export async function GET(
  request: NextRequest,
  { params }: { params: { kioskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId } = params;
    const { searchParams } = new URL(request.url);
    const includeResolved = searchParams.get('includeResolved') === 'true';

    const url = `${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/alerts${includeResolved ? '?includeResolved=true' : ''}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch alerts' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
