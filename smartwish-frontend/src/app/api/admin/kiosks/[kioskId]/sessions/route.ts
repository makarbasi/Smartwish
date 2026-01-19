import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import { sessionRowToSession } from '@/types/kioskSession';
import type { SessionOutcome, SessionSummary, KioskSessionRow } from '@/types/kioskSession';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

/**
 * GET /api/admin/kiosks/[kioskId]/sessions
 * List sessions for a kiosk with filtering and summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId } = await params;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const outcome = searchParams.get('outcome') as SessionOutcome | 'all' | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const hasSearch = searchParams.get('hasSearch');
    const hasUpload = searchParams.get('hasUpload');
    const hasEditor = searchParams.get('hasEditor');
    const hasRecording = searchParams.get('hasRecording');

    // Verify kiosk exists
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id, name')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('kiosk_sessions')
      .select('*', { count: 'exact' })
      .eq('kiosk_id', kioskId)
      .order('started_at', { ascending: false });

    // Apply filters
    if (outcome && outcome !== 'all') {
      query = query.eq('outcome', outcome);
    }

    if (startDate) {
      query = query.gte('started_at', startDate);
    }

    if (endDate) {
      query = query.lte('started_at', endDate);
    }

    if (hasSearch === 'true') {
      query = query.eq('used_search', true);
    }

    if (hasUpload === 'true') {
      query = query.eq('uploaded_image', true);
    }

    if (hasEditor === 'true') {
      query = query.eq('used_pintura_editor', true);
    }

    if (hasRecording === 'true') {
      query = query.eq('has_recording', true);
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: sessions, error: sessionsError, count } = await query;

    // Handle case where table doesn't exist yet (migration not run)
    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      
      // Check if it's a "relation does not exist" error (table not created)
      const errorMessage = sessionsError.message || '';
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        // Return empty results with a helpful message
        return NextResponse.json({
          sessions: [],
          total: 0,
          page,
          pageSize,
          summary: calculateSummary([]),
          kiosk: {
            kioskId: kiosk.kiosk_id,
            name: kiosk.name,
          },
          notice: 'Session tracking tables have not been created yet. Please run the database migration: supabase/migrations/003_create_kiosk_sessions.sql',
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    // Calculate summary stats for this kiosk (all sessions, not just filtered)
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('kiosk_sessions')
      .select('*')
      .eq('kiosk_id', kioskId);

    // If error fetching all sessions (shouldn't happen if first query succeeded), just use current page
    const summary = calculateSummary(allSessionsError ? (sessions || []) : (allSessions || []));

    // Transform sessions to camelCase
    const transformedSessions = (sessions || []).map((row: KioskSessionRow) => 
      sessionRowToSession(row)
    );

    return NextResponse.json({
      sessions: transformedSessions,
      total: count || 0,
      page,
      pageSize,
      summary,
      kiosk: {
        kioskId: kiosk.kiosk_id,
        name: kiosk.name,
      },
    });
  } catch (error) {
    console.error('Error in sessions list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateSummary(sessions: KioskSessionRow[]): SessionSummary {
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      totalEvents: 0,
      averageDuration: 0,
      outcomeBreakdown: {
        printed_card: 0,
        printed_sticker: 0,
        sent_digital: 0,
        abandoned: 0,
        in_progress: 0,
      },
      featureUsage: {
        greetingCards: 0,
        stickers: 0,
        giftCards: 0,
        search: 0,
        imageUpload: 0,
        editor: 0,
        checkout: 0,
        payment: 0,
      },
      conversionRate: 0,
    };
  }

  // Calculate totals
  let totalEvents = 0;
  let totalDuration = 0;
  let durationCount = 0;

  const outcomeBreakdown: Record<SessionOutcome, number> = {
    printed_card: 0,
    printed_sticker: 0,
    sent_digital: 0,
    abandoned: 0,
    in_progress: 0,
  };

  const featureUsage = {
    greetingCards: 0,
    stickers: 0,
    giftCards: 0,
    search: 0,
    imageUpload: 0,
    editor: 0,
    checkout: 0,
    payment: 0,
  };

  sessions.forEach((session) => {
    totalEvents += session.total_events || 0;

    if (session.duration_seconds) {
      totalDuration += session.duration_seconds;
      durationCount++;
    }

    if (session.outcome) {
      outcomeBreakdown[session.outcome]++;
    }

    if (session.browsed_greeting_cards) featureUsage.greetingCards++;
    if (session.browsed_stickers) featureUsage.stickers++;
    if (session.browsed_gift_cards) featureUsage.giftCards++;
    if (session.used_search) featureUsage.search++;
    if (session.uploaded_image) featureUsage.imageUpload++;
    if (session.used_pintura_editor) featureUsage.editor++;
    if (session.reached_checkout) featureUsage.checkout++;
    if (session.completed_payment) featureUsage.payment++;
  });

  // Calculate conversion rate
  const completedSessions = 
    outcomeBreakdown.printed_card +
    outcomeBreakdown.printed_sticker +
    outcomeBreakdown.sent_digital;
  
  const finishedSessions = totalSessions - outcomeBreakdown.in_progress;
  const conversionRate = finishedSessions > 0
    ? Math.round((completedSessions / finishedSessions) * 100)
    : 0;

  return {
    totalSessions,
    totalEvents,
    averageDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    outcomeBreakdown,
    featureUsage,
    conversionRate,
  };
}

/**
 * DELETE /api/admin/kiosks/[kioskId]/sessions
 * Delete all sessions for a kiosk, including events and recordings
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    // Check authentication
    const authSession = await auth();
    if (!authSession?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId } = await params;

    // Verify kiosk exists
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 });
    }

    // Get all sessions for this kiosk (to find ones with recordings)
    const { data: allSessions, error: sessionsError } = await supabase
      .from('kiosk_sessions')
      .select('id, has_recording')
      .eq('kiosk_id', kioskId);

    if (sessionsError) {
      console.error('Error fetching sessions for deletion:', sessionsError);
      // If table doesn't exist, that's fine - nothing to delete
      if (sessionsError.message?.includes('relation') && sessionsError.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, deleted: 0 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch sessions for deletion' },
        { status: 500 }
      );
    }

    const sessions = allSessions || [];
    const sessionsWithRecordings = sessions.filter(s => s.has_recording);

    // Delete recordings via backend for sessions that have them
    if (sessionsWithRecordings.length > 0) {
      console.log(`[Delete All] Found ${sessionsWithRecordings.length} sessions with recordings, deleting via backend...`);
      
      // Delete recordings in parallel (but limit concurrency to avoid overwhelming the backend)
      const deletePromises = sessionsWithRecordings.map(async (session) => {
        try {
          const recordingResponse = await fetch(
            `${BACKEND_URL}/admin/kiosks/${kioskId}/sessions/${session.id}/recording`,
            { method: 'DELETE' }
          );
          
          if (recordingResponse.ok) {
            console.log(`[Delete All] Recording deleted for session: ${session.id}`);
          } else {
            console.warn(`[Delete All] Failed to delete recording for session ${session.id}:`, 
              await recordingResponse.text());
          }
        } catch (recError) {
          console.warn(`[Delete All] Error calling recording delete for session ${session.id}:`, recError);
        }
      });

      // Wait for all recording deletions to complete (or fail)
      await Promise.allSettled(deletePromises);
    }

    // Get all session IDs for deleting events
    const sessionIds = sessions.map(s => s.id);

    // Delete all events for all sessions (if any sessions exist)
    if (sessionIds.length > 0) {
      const { error: eventsError } = await supabase
        .from('kiosk_session_events')
        .delete()
        .in('session_id', sessionIds);

      if (eventsError) {
        console.error('Error deleting session events:', eventsError);
        // Continue with session deletion even if events deletion fails
      } else {
        console.log(`[Delete All] Deleted events for ${sessionIds.length} sessions`);
      }
    }

    // Delete all sessions for this kiosk
    const { error: deleteError, count } = await supabase
      .from('kiosk_sessions')
      .delete()
      .eq('kiosk_id', kioskId)
      .select('id', { count: 'exact', head: true });

    if (deleteError) {
      console.error('Error deleting sessions:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete sessions' },
        { status: 500 }
      );
    }

    const deletedCount = count || sessionIds.length;
    console.log(`[Delete All] Deleted ${deletedCount} sessions for kiosk: ${kioskId}`);

    return NextResponse.json({ 
      success: true, 
      deleted: deletedCount 
    });
  } catch (error) {
    console.error('Error in delete all sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
