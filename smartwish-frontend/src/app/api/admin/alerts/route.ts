import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// GET /api/admin/alerts - Get all active alerts across all kiosks
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all kiosks first, then get alerts for each
    // In production, you'd have a dedicated endpoint for all alerts
    const kiosksResponse = await fetch(`${API_BASE}/admin/kiosks`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!kiosksResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch kiosks' },
        { status: kiosksResponse.status }
      );
    }

    const kiosks = await kiosksResponse.json();
    
    // Collect all alerts from all kiosks
    const allAlerts: any[] = [];
    
    for (const kiosk of kiosks) {
      try {
        const alertsResponse = await fetch(
          `${API_BASE}/admin/kiosks/${encodeURIComponent(kiosk.kioskId)}/alerts`,
          {
            headers: {
              Authorization: `Bearer ${session.user.access_token}`,
              'Cache-Control': 'no-cache',
            },
            cache: 'no-store',
          }
        );
        
        if (alertsResponse.ok) {
          const alerts = await alertsResponse.json();
          // Add kiosk info to each alert
          const alertsWithKiosk = alerts.map((alert: any) => ({
            ...alert,
            kiosk: {
              kioskId: kiosk.kioskId,
              name: kiosk.name,
            },
          }));
          allAlerts.push(...alertsWithKiosk);
        }
      } catch (error) {
        // Skip this kiosk if alerts fetch fails
        console.error(`Failed to fetch alerts for kiosk ${kiosk.kioskId}:`, error);
      }
    }

    // Sort by severity and then by creation date
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    allAlerts.sort((a, b) => {
      const severityDiff =
        (severityOrder[a.severity as keyof typeof severityOrder] || 99) -
        (severityOrder[b.severity as keyof typeof severityOrder] || 99);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Prevent caching of the response
    return NextResponse.json(allAlerts, {
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
