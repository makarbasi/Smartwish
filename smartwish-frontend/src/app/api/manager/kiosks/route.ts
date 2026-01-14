import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * GET /api/manager/kiosks
 * Get kiosks assigned to the authenticated manager
 * Proxies to backend: GET /managers/my-kiosks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      console.error('No access token in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Fetching kiosks for manager, user ID:', session.user.id);

    const response = await fetch(`${API_BASE}/managers/my-kiosks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text);
      return NextResponse.json(
        { error: text || 'Backend returned non-JSON response' },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();
    console.log('Backend response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Backend error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to fetch kiosks' },
        { status: response.status }
      );
    }

    // Backend returns an array directly, but frontend expects { kiosks: [...] }
    // Also transform the data to match frontend expectations
    const kiosksArray = Array.isArray(data) ? data : (data.kiosks || []);
    console.log('Kiosks array length:', kiosksArray.length);
    
    // Get all kiosk IDs to check for active sessions and device heartbeats
    const kioskIds = kiosksArray.map((k: any) => k.kioskId);
    console.log('[Manager Kiosks] Checking status for kiosk IDs:', kioskIds);
    
    // Check for active sessions (outcome = 'in_progress' and ended_at IS NULL)
    let kiosksWithActiveSessions: Set<string> = new Set();
    
    // Check for device heartbeats (lastHeartbeat in config)
    // Device is only online if heartbeat is within last 2 minutes AND there's an active session
    const twoMinutesAgo = new Date();
    twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
    
    // Also fetch kiosk configs directly from Supabase to check heartbeats
    let kioskConfigsMap: Map<string, { lastHeartbeat?: string }> = new Map();
    let kioskConfigsData: any[] = [];
    
    if (kioskIds.length > 0) {
      try {
        // Get kiosk configs from Supabase to check heartbeats
        const { data: kioskConfigs, error: configError } = await supabase
          .from('kiosk_configs')
          .select('id, kiosk_id, config')
          .in('kiosk_id', kioskIds);
        
        if (!configError && kioskConfigs) {
          kioskConfigsData = kioskConfigs; // Store for cleanup later
          kioskConfigs.forEach((kc: any) => {
            kioskConfigsMap.set(kc.kiosk_id, {
              lastHeartbeat: kc.config?.lastHeartbeat,
            });
          });
          console.log('[Manager Kiosks] Fetched kiosk configs for heartbeat check:', kioskConfigs.length);
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
          console.log('[Manager Kiosks] Kiosks with active sessions:', Array.from(kiosksWithActiveSessions));
          console.log('[Manager Kiosks] Active session details:', activeSessions);
        } else if (sessionError) {
          console.error('[Manager Kiosks] Error fetching active sessions:', sessionError);
        }
        
        // Auto-end stale sessions (older than 24h)
        const { data: staleSessions } = await supabase
          .from('kiosk_sessions')
          .select('id, kiosk_id, started_at')
          .in('kiosk_id', kioskIds)
          .eq('outcome', 'in_progress')
          .is('ended_at', null)
          .lt('started_at', twentyFourHoursAgo.toISOString());
        
        if (staleSessions && staleSessions.length > 0) {
          console.log('[Manager Kiosks] Auto-ending', staleSessions.length, 'stale sessions');
          const staleSessionIds = staleSessions.map((s: any) => s.id);
          await supabase
            .from('kiosk_sessions')
            .update({
              outcome: 'abandoned',
              ended_at: new Date().toISOString(),
            })
            .in('id', staleSessionIds);
        }
        
        // Clear stale heartbeats (older than 5 minutes)
        // This indicates the browser was closed or stopped sending heartbeats
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        for (const kioskConfig of kioskConfigsData) {
          const kioskId = kioskConfig.kiosk_id;
          const heartbeat = kioskConfig.config?.lastHeartbeat;
          
          // Clear heartbeat if it's older than 5 minutes (browser likely closed)
          if (heartbeat) {
            try {
              const heartbeatDate = new Date(heartbeat);
              if (heartbeatDate < fiveMinutesAgo) {
                const minutesOld = Math.floor((Date.now() - heartbeatDate.getTime()) / 1000 / 60);
                console.log(`[Manager Kiosks] Clearing stale heartbeat for kiosk ${kioskId} (heartbeat ${minutesOld} minutes old - browser likely closed)`);
                
                const updatedConfig = {
                  ...(kioskConfig.config || {}),
                  lastHeartbeat: null, // Clear the stale heartbeat
                };
                
                await supabase
                  .from('kiosk_configs')
                  .update({
                    config: updatedConfig,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('kiosk_id', kioskId);
              }
            } catch (error) {
              console.error(`[Manager Kiosks] Error clearing stale heartbeat for ${kioskId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('[Manager Kiosks] Error checking sessions/configs:', error);
      }
    }
    
    const transformedKiosks = kiosksArray.map((kiosk: any) => {
      // Check if there's an active user session first
      const hasActiveSession = kiosksWithActiveSessions.has(kiosk.kioskId);
      
      // Get heartbeat from both backend config and Supabase config (backend might have cached data)
      const backendHeartbeat = kiosk.config?.lastHeartbeat;
      const supabaseConfig = kioskConfigsMap.get(kiosk.kioskId);
      const supabaseHeartbeat = supabaseConfig?.lastHeartbeat;
      
      // Use the most recent heartbeat (prefer Supabase as it's the source of truth)
      const lastHeartbeat = supabaseHeartbeat || backendHeartbeat;
      
      console.log(`[Manager Kiosks] Processing kiosk ${kiosk.kioskId}:`, {
        hasConfig: !!kiosk.config,
        backendHeartbeat,
        supabaseHeartbeat,
        lastHeartbeat,
        hasActiveSession,
      });
      
      let isDeviceOnline = false;
      
      // Device is online if there's a recent heartbeat (within last 2 minutes)
      // This indicates the browser is open and responsive, regardless of active user session
      // Active session is tracked separately to show if someone is actively using the kiosk
      if (lastHeartbeat) {
        try {
          const heartbeatDate = new Date(lastHeartbeat);
          const now = new Date();
          const minutesSinceHeartbeat = (now.getTime() - heartbeatDate.getTime()) / 1000 / 60;
          
          // Device is online if heartbeat was within last 2 minutes (browser is open)
          isDeviceOnline = heartbeatDate > twoMinutesAgo && heartbeatDate <= now;
          
          console.log(`[Manager Kiosks] Kiosk ${kiosk.kioskId} status check:`, {
            lastHeartbeat,
            heartbeatDate: heartbeatDate.toISOString(),
            twoMinutesAgo: twoMinutesAgo.toISOString(),
            now: now.toISOString(),
            minutesSinceHeartbeat: minutesSinceHeartbeat.toFixed(2),
            hasActiveSession,
            isDeviceOnline,
            isValidDate: !isNaN(heartbeatDate.getTime()),
          });
          
          if (!isDeviceOnline) {
            console.log(`[Manager Kiosks] Kiosk ${kiosk.kioskId} is offline: heartbeat is stale (${minutesSinceHeartbeat.toFixed(2)} minutes old) - browser likely closed`);
          } else {
            console.log(`[Manager Kiosk] Kiosk ${kiosk.kioskId} is online: browser is open and responsive`);
          }
        } catch (error) {
          console.error(`[Manager Kiosks] Error parsing heartbeat for ${kiosk.kioskId}:`, error, lastHeartbeat);
          isDeviceOnline = false;
        }
      } else {
        console.log(`[Manager Kiosks] Kiosk ${kiosk.kioskId} is offline: no heartbeat (browser not open or not sending heartbeats)`);
      }
      
      console.log(`[Manager Kiosks] Kiosk ${kiosk.kioskId} final status:`, {
        isDeviceOnline,
        hasActiveSession,
        lastHeartbeat,
        deviceStatusReason: isDeviceOnline ? 'Browser open and responsive' : (!lastHeartbeat ? 'No heartbeat (browser closed)' : 'Heartbeat too old (browser likely closed)'),
        sessionStatusReason: hasActiveSession ? 'User actively using kiosk' : 'No active user session (idle or timed out)',
      });
      
      return {
        id: kiosk.id,
        kioskId: kiosk.kioskId,
        name: kiosk.name || kiosk.kioskId,
        location: kiosk.config?.location || kiosk.storeId || null,
        status: kiosk.isActive !== undefined ? (kiosk.isActive ? 'active' : 'inactive') : 'active',
        isOnline: isDeviceOnline, // Device online status (based on heartbeat + active session)
        hasActiveSession, // Active user session status
        printerStatus: kiosk.config?.printerStatus || null,
        lastPrintAt: kiosk.config?.lastPrintAt || null,
        printCount: kiosk.config?.printCount || 0,
        lastHeartbeat: lastHeartbeat || null,
        createdAt: kiosk.assignedAt || kiosk.createdAt || new Date().toISOString(),
      };
    });

    return NextResponse.json({ kiosks: transformedKiosks });
  } catch (error) {
    console.error('Error fetching kiosks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
