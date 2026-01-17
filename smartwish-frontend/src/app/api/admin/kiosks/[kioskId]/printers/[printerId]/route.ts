import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// PUT /api/admin/kiosks/[kioskId]/printers/[printerId] - Update a printer
export async function PUT(
  request: NextRequest,
  { params }: { params: { kioskId: string; printerId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, printerId } = params;
    const body = await request.json();

    const response = await fetch(
      `${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/printers/${encodeURIComponent(printerId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update printer' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to update printer' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating printer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/kiosks/[kioskId]/printers/[printerId] - Delete a printer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { kioskId: string; printerId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, printerId } = params;

    const response = await fetch(
      `${API_BASE}/admin/kiosks/${encodeURIComponent(kioskId)}/printers/${encodeURIComponent(printerId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete printer' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to delete printer' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting printer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
