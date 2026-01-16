import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import type { SessionEventType } from '@/types/kioskSession';

interface EventPayload {
  eventType: SessionEventType;
  page: string;
  zone?: string;
  details?: Record<string, unknown>;
  coordinates?: {
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  timestamp?: string;
}

/**
 * POST /api/kiosk/session/events
 * Log a batch of session events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, events } = body as { sessionId: string; events: EventPayload[] };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'events array is required' },
        { status: 400 }
      );
    }

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('id, outcome, pages_visited, total_events, total_clicks')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    if (session.outcome !== 'in_progress') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      );
    }

    // Prepare events for insertion
    const eventRecords = events.map((event) => ({
      session_id: sessionId,
      event_type: event.eventType,
      page: event.page,
      zone: event.zone || null,
      details: event.details || {},
      coordinates: event.coordinates || null,
      timestamp: event.timestamp || new Date().toISOString(),
    }));

    // Insert events
    const { error: insertError } = await supabase
      .from('kiosk_session_events')
      .insert(eventRecords);

    if (insertError) {
      console.error('Error inserting events:', insertError);
      return NextResponse.json(
        { error: 'Failed to log events' },
        { status: 500 }
      );
    }

    // Update session stats
    const pagesVisited = new Set(session.pages_visited || []);
    let clickCount = 0;
    const featureFlags: Record<string, boolean> = {};

    events.forEach((event) => {
      // Track pages
      if (event.page) {
        pagesVisited.add(event.page);
      }

      // Count clicks
      if (event.eventType === 'click') {
        clickCount++;
      }

      // Track feature usage
      switch (event.eventType) {
        case 'card_browse':
        case 'card_select':
        case 'card_search':
        case 'card_customize':
          featureFlags.browsed_greeting_cards = true;
          break;
        case 'sticker_browse':
        case 'sticker_select':
        case 'sticker_search':
          featureFlags.browsed_stickers = true;
          break;
        case 'giftcard_browse':
        case 'giftcard_select':
        case 'giftcard_search':
        case 'giftcard_purchase':
          featureFlags.browsed_gift_cards = true;
          break;
        case 'search':
        case 'card_search':
        case 'sticker_search':
        case 'giftcard_search':
          featureFlags.used_search = true;
          break;
        case 'sticker_upload_start':
        case 'sticker_upload_complete':
          featureFlags.uploaded_image = true;
          break;
        case 'editor_open':
        case 'editor_tool_use':
        case 'editor_save':
          featureFlags.used_pintura_editor = true;
          break;
        case 'checkout_start':
          featureFlags.reached_checkout = true;
          break;
        case 'payment_success':
          featureFlags.completed_payment = true;
          break;
      }
    });

    // Build update object
    const updateData: Record<string, unknown> = {
      pages_visited: Array.from(pagesVisited),
      total_events: (session.total_events || 0) + events.length,
      total_clicks: (session.total_clicks || 0) + clickCount,
      ...featureFlags,
    };

    // Update session
    const { error: updateError } = await supabase
      .from('kiosk_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session stats:', updateError);
      // Non-critical error, don't fail the request
    }

    return NextResponse.json({
      success: true,
      eventsLogged: events.length,
    });
  } catch (error) {
    console.error('Error in session events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
