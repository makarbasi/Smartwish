import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// GET /api/admin/alerts - Get all active alerts across all kiosks
// Uses the dedicated /admin/kiosks/critical-alerts endpoint (single DB query)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the dedicated critical-alerts endpoint (single query, no N+1 problem)
    const alertsResponse = await fetch(`${API_BASE}/admin/kiosks/critical-alerts`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!alertsResponse.ok) {
      // If the endpoint fails, return empty array rather than error
      // This prevents the banner from breaking the UI
      console.error(`Failed to fetch alerts: ${alertsResponse.status}`);
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    const alerts = await alertsResponse.json();
    
    // Transform to match expected format (add kiosk object for compatibility)
    const formattedAlerts = alerts.map((alert: any) => ({
      ...alert,
      kiosk: {
        kioskId: alert.kioskId,
        name: alert.kioskName,
      },
    }));

    // Alerts are already sorted by the backend, but ensure proper order
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    formattedAlerts.sort((a: any, b: any) => {
      const severityDiff =
        (severityOrder[a.severity as keyof typeof severityOrder] || 99) -
        (severityOrder[b.severity as keyof typeof severityOrder] || 99);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(formattedAlerts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
