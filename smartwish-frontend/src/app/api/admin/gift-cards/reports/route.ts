import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * GET /api/admin/gift-cards/reports
 * Get analytics data for gift cards
 * Proxies to backend: GET /admin/gift-cards/reports/summary
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, session, error } = await verifyAdmin();
    if (!authorized) return error;

    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';

    const response = await fetch(
      `${API_BASE}/admin/gift-cards/reports/summary?days=${days}`,
      {
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch reports' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Error fetching gift card reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
