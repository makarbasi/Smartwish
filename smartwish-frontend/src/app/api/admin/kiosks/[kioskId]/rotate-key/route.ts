import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

export async function POST(
  request: NextRequest,
  { params }: { params: { kioskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId } = params;

    const response = await fetch(
      `${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/rotate-key`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to rotate API key' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error rotating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
