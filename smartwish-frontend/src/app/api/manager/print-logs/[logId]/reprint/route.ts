import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

interface RouteParams {
  params: Promise<{ logId: string }>;
}

/**
 * POST /api/manager/print-logs/[logId]/reprint
 * Reprint a completed print job
 * Proxies to backend: POST /managers/print-logs/:logId/reprint
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { logId } = await params;

    const response = await fetch(`${API_BASE}/managers/print-logs/${logId}/reprint`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to reprint' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reprinting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
