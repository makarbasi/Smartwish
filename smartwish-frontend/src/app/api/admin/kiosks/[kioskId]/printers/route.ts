import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// GET /api/admin/kiosks/[kioskId]/printers - Get all printers for a kiosk
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

    const response = await fetch(`${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/printers`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch printers' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching printers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/kiosks/[kioskId]/printers - Add a new printer
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
    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/printers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to add printer' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to add printer' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error adding printer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
