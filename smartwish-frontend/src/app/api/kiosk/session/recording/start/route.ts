import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/session/recording/start
 * Create a new recording record when session recording begins
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, kioskId, resolution, frameRate } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!kioskId) {
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('id, kiosk_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Create recording record
    const { data: recording, error: recordingError } = await supabase
      .from('session_recordings')
      .insert({
        session_id: sessionId,
        kiosk_id: session.kiosk_id,
        resolution: resolution || '1280x720',
        frame_rate: frameRate || 1,
        status: 'recording',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (recordingError) {
      console.error('[Recording] Error creating recording record:', recordingError);
      return NextResponse.json(
        { error: 'Failed to create recording record' },
        { status: 500 }
      );
    }

    // Update session to indicate it has a recording
    await supabase
      .from('kiosk_sessions')
      .update({ has_recording: true })
      .eq('id', sessionId);

    console.log('[Recording] Created recording record:', recording.id, 'for session:', sessionId);

    return NextResponse.json({
      success: true,
      recordingId: recording.id,
    });
  } catch (error) {
    console.error('[Recording] Error in recording start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

