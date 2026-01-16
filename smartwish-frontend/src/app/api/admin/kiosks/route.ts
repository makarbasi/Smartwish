import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE}/admin/kiosks`, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch kiosks' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const kiosksArray = Array.isArray(data) ? data : (data.data || data.kiosks || []);
    
    // Get all kiosk IDs to check for active sessions and device heartbeats
    const kioskIds = kiosksArray
      .map((k: any) => k.kioskId)
      .filter((id: string) => id != null && id !== undefined && id !== '');
    
    // Check for active sessions and heartbeats
    let kiosksWithActiveSessions: Set<string> = new Set();
    let kioskConfigsMap: Map<string, { lastHeartbeat?: string }> = new Map();
    
    if (kioskIds.length > 0) {
      try {
        // Get kiosk configs from Supabase to check heartbeats
        const { data: kioskConfigs, error: configError } = await supabase
          .from('kiosk_configs')
          .select('id, kiosk_id, config')
          .in('kiosk_id', kioskIds);
        
        if (!configError && kioskConfigs) {
          kioskConfigs.forEach((kc: any) => {
            kioskConfigsMap.set(kc.kiosk_id, {
              lastHeartbeat: kc.config?.lastHeartbeat,
            });
          });
        }
        
        // Check for active sessions
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        
        const { data: activeSessions, error: sessionError } = await supabase
          .from('kiosk_sessions')
          .select('kiosk_id, started_at, outcome, ended_at')
          .in('kiosk_id', kioskIds)
          .eq('outcome', 'in_progress')
          .is('ended_at', null)
          .gte('started_at', twentyFourHoursAgo.toISOString());
        
        if (!sessionError && activeSessions) {
          kiosksWithActiveSessions = new Set(activeSessions.map((s: any) => s.kiosk_id));
        }
      } catch (error) {
        console.error('[Admin Kiosks] Error checking sessions/configs:', error);
      }
    }
    
    // Add status to each kiosk
    const twoMinutesAgo = new Date();
    twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
    const ninetySecondsAgo = new Date();
    ninetySecondsAgo.setSeconds(ninetySecondsAgo.getSeconds() - 90);
    
    const enrichedKiosks = kiosksArray.map((kiosk: any) => {
      const hasActiveSession = kiosksWithActiveSessions.has(kiosk.kioskId);
      const supabaseConfig = kioskConfigsMap.get(kiosk.kioskId);
      const lastHeartbeat = supabaseConfig?.lastHeartbeat || kiosk.config?.lastHeartbeat;
      
      let isDeviceOnline = false;
      if (lastHeartbeat) {
        try {
          const heartbeatDate = new Date(lastHeartbeat);
          const heartbeatThreshold = hasActiveSession ? twoMinutesAgo : ninetySecondsAgo;
          isDeviceOnline = heartbeatDate > heartbeatThreshold && heartbeatDate <= new Date();
        } catch (error) {
          isDeviceOnline = false;
        }
      }
      
      return {
        ...kiosk,
        isOnline: isDeviceOnline,
        hasActiveSession,
        lastHeartbeat: lastHeartbeat || null,
      };
    });
    
    return NextResponse.json(Array.isArray(data) ? enrichedKiosks : { ...data, data: enrichedKiosks });
  } catch (error) {
    console.error('Error fetching kiosks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/kiosks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to create kiosk' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating kiosk:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
