import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import type { SessionOutcome } from '@/types/kioskSession';

/**
 * POST /api/kiosk/session/end
 * End a kiosk working session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, outcome } = body as { sessionId: string; outcome: SessionOutcome };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!outcome) {
      return NextResponse.json(
        { error: 'outcome is required' },
        { status: 400 }
      );
    }

    const validOutcomes: SessionOutcome[] = [
      'printed_card',
      'printed_sticker',
      'sent_digital',
      'abandoned',
    ];

    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: 'Invalid outcome' },
        { status: 400 }
      );
    }

    // Get session to calculate duration
    const { data: session, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('id, started_at, outcome')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Allow ending only in_progress sessions (or re-ending for idempotency)
    if (session.outcome !== 'in_progress' && session.outcome !== outcome) {
      return NextResponse.json(
        { error: 'Session already ended with different outcome' },
        { status: 400 }
      );
    }

    // Calculate duration
    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('kiosk_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        outcome,
      })
      .eq('id', sessionId)
      .select('id, kiosk_id, outcome, ended_at')
      .single();

    if (updateError) {
      console.error('[Session End] Error ending session:', updateError);
      return NextResponse.json(
        { error: 'Failed to end session' },
        { status: 500 }
      );
    }

    console.log(`[Session End] Successfully ended session ${sessionId} for kiosk ${updatedSession?.kiosk_id}:`, {
      outcome: updatedSession?.outcome,
      ended_at: updatedSession?.ended_at,
    });

    // Log session_end event
    const { error: eventError } = await supabase
      .from('kiosk_session_events')
      .insert({
        session_id: sessionId,
        event_type: 'session_end',
        page: '', // Will be set by the client
        details: { outcome, durationSeconds },
      });

    if (eventError) {
      console.error('Error logging session end event:', eventError);
    }

    // NOTE: Recording stop is triggered CLIENT-SIDE by the kiosk browser
    // The browser runs locally and can reach localhost:8766 (print agent)
    // This server-side code (on Vercel) cannot reach the local print agent
    
    console.log(`[Session] Ended session: ${sessionId} with outcome: ${outcome} (${durationSeconds}s)`);

    return NextResponse.json({
      success: true,
      sessionId,
      outcome,
      durationSeconds,
    });
  } catch (error) {
    console.error('Error in session end:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
