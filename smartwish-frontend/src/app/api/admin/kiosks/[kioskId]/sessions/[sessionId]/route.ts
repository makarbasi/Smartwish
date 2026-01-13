import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import {
  sessionRowToSession,
  eventRowToEvent,
} from '@/types/kioskSession';
import type {
  KioskSessionRow,
  KioskSessionEventRow,
  SessionJourneyStep,
} from '@/types/kioskSession';

/**
 * GET /api/admin/kiosks/[kioskId]/sessions/[sessionId]
 * Get detailed session information including events and journey
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    // Check authentication
    const authSession = await auth();
    if (!authSession?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Fetch session
    const { data: sessionData, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('kiosk_id', kioskId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch events
    const { data: eventsData, error: eventsError } = await supabase
      .from('kiosk_session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch session events' },
        { status: 500 }
      );
    }

    const sessionRow = sessionData as KioskSessionRow;
    const eventRows = (eventsData || []) as KioskSessionEventRow[];

    // Transform data
    const transformedSession = sessionRowToSession(sessionRow);
    const transformedEvents = eventRows.map(eventRowToEvent);

    // Build journey
    const journey = buildJourney(eventRows);

    // Generate behavior summary
    const behaviorSummary = generateBehaviorSummary(sessionRow, eventRows);

    return NextResponse.json({
      session: transformedSession,
      events: transformedEvents,
      journey,
      behaviorSummary,
    });
  } catch (error) {
    console.error('Error in session detail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/kiosks/[kioskId]/sessions/[sessionId]
 * Delete a session and its events
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    // Check authentication
    const authSession = await auth();
    if (!authSession?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Verify session belongs to this kiosk
    const { data: sessionData, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('kiosk_id', kioskId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete events first (cascade should handle this, but being explicit)
    await supabase
      .from('kiosk_session_events')
      .delete()
      .eq('session_id', sessionId);

    // Delete session
    const { error: deleteError } = await supabase
      .from('kiosk_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      console.error('Error deleting session:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      );
    }

    console.log(`[Session] Deleted session: ${sessionId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in session delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildJourney(events: KioskSessionEventRow[]): SessionJourneyStep[] {
  const journey: SessionJourneyStep[] = [];
  let currentPage: string | null = null;
  let pageEnteredAt: string | null = null;
  let pageEvents: KioskSessionEventRow[] = [];

  events.forEach((event) => {
    if (event.event_type === 'page_view') {
      // Finalize previous page
      if (currentPage && pageEnteredAt) {
        journey.push(createJourneyStep(currentPage, pageEnteredAt, event.timestamp, pageEvents));
      }

      // Start new page
      currentPage = event.page;
      pageEnteredAt = event.timestamp;
      pageEvents = [event];
    } else if (currentPage) {
      pageEvents.push(event);
    }
  });

  // Finalize last page
  if (currentPage && pageEnteredAt) {
    const lastEvent = events[events.length - 1];
    journey.push(createJourneyStep(currentPage, pageEnteredAt, lastEvent?.timestamp || null, pageEvents));
  }

  return journey;
}

function createJourneyStep(
  page: string,
  enteredAt: string,
  exitedAt: string | null,
  events: KioskSessionEventRow[]
): SessionJourneyStep {
  const durationMs = exitedAt
    ? new Date(exitedAt).getTime() - new Date(enteredAt).getTime()
    : 0;

  // Extract highlights from events
  const highlights: string[] = [];
  const eventTypes = new Set(events.map((e) => e.event_type));

  if (eventTypes.has('search') || eventTypes.has('card_search') || eventTypes.has('sticker_search')) {
    const searchEvent = events.find((e) => e.event_type.includes('search'));
    if (searchEvent?.details?.searchQuery) {
      highlights.push(`Searched: "${searchEvent.details.searchQuery}"`);
    }
  }

  if (eventTypes.has('card_select')) {
    highlights.push('Selected a greeting card');
  }

  if (eventTypes.has('sticker_select')) {
    highlights.push('Selected a sticker');
  }

  if (eventTypes.has('editor_open')) {
    highlights.push('Opened the editor');
  }

  if (eventTypes.has('sticker_upload_complete')) {
    highlights.push('Uploaded an image');
  }

  if (eventTypes.has('checkout_start')) {
    highlights.push('Started checkout');
  }

  if (eventTypes.has('payment_success')) {
    highlights.push('Completed payment');
  }

  if (eventTypes.has('print_complete')) {
    highlights.push('Printed successfully');
  }

  const clickCount = events.filter((e) => e.event_type === 'click').length;
  if (clickCount > 0) {
    highlights.push(`${clickCount} clicks`);
  }

  return {
    page,
    enteredAt,
    exitedAt,
    durationMs,
    eventCount: events.length,
    highlights,
  };
}

function generateBehaviorSummary(
  session: KioskSessionRow,
  events: KioskSessionEventRow[]
): string {
  const parts: string[] = [];

  // Session duration
  if (session.duration_seconds) {
    const minutes = Math.floor(session.duration_seconds / 60);
    const seconds = session.duration_seconds % 60;
    if (minutes > 0) {
      parts.push(`Session lasted ${minutes}m ${seconds}s`);
    } else {
      parts.push(`Session lasted ${seconds} seconds`);
    }
  }

  // Pages visited
  const pageCount = (session.pages_visited || []).length;
  if (pageCount > 0) {
    parts.push(`visited ${pageCount} page${pageCount > 1 ? 's' : ''}`);
  }

  // Feature usage
  const features: string[] = [];

  if (session.browsed_greeting_cards) {
    const cardEvents = events.filter((e) => e.event_type.startsWith('card_'));
    if (cardEvents.length > 0) {
      features.push('browsed greeting cards');
    }
  }

  if (session.browsed_stickers) {
    features.push('explored stickers');
  }

  if (session.used_search) {
    const searchEvents = events.filter((e) => e.event_type.includes('search'));
    const queries = searchEvents
      .map((e) => e.details?.searchQuery)
      .filter(Boolean)
      .slice(0, 2);
    if (queries.length > 0) {
      features.push(`searched for "${queries.join('", "')}"`);
    } else {
      features.push('used search');
    }
  }

  if (session.uploaded_image) {
    features.push('uploaded a custom image');
  }

  if (session.used_pintura_editor) {
    const editTime = events
      .filter((e) => e.event_type === 'editor_save')
      .reduce((acc, e) => acc + ((e.details?.editDurationMs as number) || 0), 0);
    if (editTime > 0) {
      const editMinutes = Math.round(editTime / 60000);
      features.push(`edited for ~${editMinutes}m in Pintura`);
    } else {
      features.push('used the Pintura editor');
    }
  }

  if (features.length > 0) {
    parts.push(features.join(', '));
  }

  // Outcome
  switch (session.outcome) {
    case 'printed_card':
      parts.push('and successfully printed a greeting card');
      break;
    case 'printed_sticker':
      parts.push('and successfully printed stickers');
      break;
    case 'sent_digital':
      parts.push('and sent a digital card');
      break;
    case 'abandoned':
      if (session.reached_checkout) {
        parts.push('but abandoned at checkout');
      } else {
        parts.push('but left without completing');
      }
      break;
    case 'in_progress':
      parts.push('(session still in progress)');
      break;
  }

  return parts.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.';
}
