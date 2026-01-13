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

    // Verify the kiosk exists
    // Note: kioskId is the UUID (id field), not the kiosk_id string field
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('id, kiosk_id')
      .eq('id', kioskId)
      .single();

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
