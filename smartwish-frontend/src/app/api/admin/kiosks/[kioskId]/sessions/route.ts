import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import { sessionRowToSession } from '@/types/kioskSession';
import type { SessionOutcome, SessionSummary, KioskSessionRow } from '@/types/kioskSession';

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
