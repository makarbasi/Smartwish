import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/session/start
 * Start a new kiosk working session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kioskId } = body;

    if (!kioskId) {
      console.log('[Session] Error: kioskId is required but was not provided');
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    console.log(`[Session] Starting session for kiosk: ${kioskId}`);

    // Check if input looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kioskId);

    // Verify the kiosk exists - try by UUID first, then by kiosk_id string
    // Also fetch kiosk config for recording settings
    let kiosk;
    let kioskError;

    if (isUuid) {
      const result = await supabase
        .from('kiosk_configs')
        .select('id, kiosk_id, config')
        .eq('id', kioskId)
        .single();
      kiosk = result.data;
      kioskError = result.error;
    }

    if (!kiosk) {
      // Try by kiosk_id string (human-readable ID like "laptop_kiosk")
      const result = await supabase
        .from('kiosk_configs')
        .select('id, kiosk_id, config')
        .eq('kiosk_id', kioskId)
        .single();
      kiosk = result.data;
      kioskError = result.error;
    }

    if (kioskError || !kiosk) {
      console.log(`[Session] Error: Kiosk with id '${kioskId}' not found in kiosk_configs table`);
      console.log(`[Session] Supabase error:`, kioskError);
      return NextResponse.json(
        { error: `Invalid kiosk ID: '${kioskId}' not found in database` },
        { status: 400 }
      );
    }

    // Create a new session using the kiosk's string ID
    const { data: session, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .insert({
        kiosk_id: kiosk.kiosk_id, // Use the string kiosk_id, not the UUID
        outcome: 'in_progress',
        pages_visited: [],
        total_events: 0,
        total_clicks: 0,
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Log the session_start event
    const { error: eventError } = await supabase
      .from('kiosk_session_events')
      .insert({
        session_id: session.id,
        event_type: 'session_start',
        page: '/kiosk/home',
        details: { kioskId: kiosk.kiosk_id },
      });

    if (eventError) {
      console.error('Error logging session start event:', eventError);
    }

    // Trigger Python recording if enabled (call local print agent)
    // This happens automatically in the background - no user interaction needed
    try {
      const pairingPort = 8766; // Default pairing server port
      const kioskConfig = kiosk.config || {};
      const recordingConfig = kioskConfig.recording || {};
      
      // Check if recording is enabled for this kiosk
      const recordWebcam = recordingConfig.recordWebcam !== false; // Default: enabled
      const recordScreen = recordingConfig.recordScreen !== false; // Default: enabled
      
      if (recordWebcam || recordScreen) {
        console.log(`[Session] Triggering Python recording for session ${session.id}...`);
        
        // Call local print agent to start recording (non-blocking)
        fetch(`http://localhost:${pairingPort}/session/recording/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            kioskConfig: {
              recording: recordingConfig,
            },
          }),
        }).catch((err) => {
          // If local agent is not running, that's okay - recording just won't happen
          console.log(`[Session] Could not reach local print agent for recording: ${err.message}`);
          console.log('[Session] Recording will be skipped (local agent may not be running)');
        });
      } else {
        console.log(`[Session] Recording disabled for kiosk ${kiosk.kiosk_id}`);
      }
    } catch (err) {
      // Recording failure should not affect session creation
      console.log(`[Session] Failed to trigger recording (non-critical): ${err}`);
    }

    console.log(`[Session] Started new session: ${session.id} for kiosk: ${kiosk.kiosk_id}`);

    return NextResponse.json({
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error in session start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
