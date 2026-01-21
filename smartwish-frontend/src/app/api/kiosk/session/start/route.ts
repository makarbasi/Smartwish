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

    // Get recording config to return to client
    // NOTE: Recording is triggered CLIENT-SIDE because the kiosk browser runs locally
    // and can reach localhost:8766 (the print agent). The server (Vercel) cannot.
    const kioskConfig = kiosk.config || {};
    const recordingConfig = kioskConfig.recording || {};
    
    const recordWebcam = recordingConfig.recordWebcam !== false; // Default: enabled
    const recordScreen = recordingConfig.recordScreen !== false; // Default: enabled

    console.log(`[Session] Started new session: ${session.id} for kiosk: ${kiosk.kiosk_id}`);
    console.log(`[Session] Recording config: webcam=${recordWebcam}, screen=${recordScreen}`);

    return NextResponse.json({
      sessionId: session.id,
      // Return recording config so client can trigger recording locally
      recording: {
        enabled: recordWebcam || recordScreen,
        recordWebcam,
        recordScreen,
        config: recordingConfig,
      },
    });
  } catch (error) {
    console.error('Error in session start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
