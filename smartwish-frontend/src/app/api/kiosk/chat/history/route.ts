import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/kiosk/chat/history
 * Get chat history for a kiosk
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Kiosk Chat History] Request received');
    const searchParams = request.nextUrl.searchParams;
    const kioskId = searchParams.get('kioskId');
    const sessionId = searchParams.get('sessionId'); // Session ID for isolating user chats
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const before = searchParams.get('before'); // message ID for pagination

    console.log('[Kiosk Chat History] Params:', { kioskId, sessionId, limit, before });

    if (!kioskId) {
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    // Verify kiosk exists
    console.log('[Kiosk Chat History] Verifying kiosk exists...');
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      console.error('[Kiosk Chat History] Kiosk verification failed:', kioskError);
      return NextResponse.json(
        { error: `Invalid kiosk ID: ${kioskError?.message || 'Not found'}` },
        { status: 400 }
      );
    }

    console.log('[Kiosk Chat History] Kiosk verified, fetching messages...');

    // Build query - STRICTLY filter by sessionId for user isolation
    // Each session should only see its own messages (no old/legacy messages)
    let query = supabase
      .from('kiosk_chat_messages')
      .select('*')
      .eq('kiosk_id', kioskId);
    
    if (sessionId) {
      // STRICT: Only return messages from this session
      // This ensures user isolation - new session = fresh chat
      query = query.eq('session_id', sessionId);
      console.log('[Kiosk Chat History] STRICT filtering by session:', sessionId);
    }
    
    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    // Pagination: get messages before a specific message
    if (before) {
      const { data: beforeMessage } = await supabase
        .from('kiosk_chat_messages')
        .select('created_at')
        .eq('id', before)
        .single();

      if (beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at);
      }
    }

    const { data: messages, error: fetchError } = await query;

    // If error is about table not existing, provide helpful message
    if (fetchError) {
      console.error('[Kiosk Chat History] Query error:', fetchError);
      console.error('[Kiosk Chat History] Error code:', fetchError.code);
      console.error('[Kiosk Chat History] Error message:', fetchError.message);
      console.error('[Kiosk Chat History] Full error:', JSON.stringify(fetchError, null, 2));
      
      if (fetchError.message?.includes('does not exist') || fetchError.code === '42P01' || fetchError.message?.includes('relation') || fetchError.message?.includes('table')) {
        console.error('[Kiosk Chat] Table does not exist. Please run the migration:', fetchError);
        return NextResponse.json(
          { 
            error: 'Chat table does not exist. Please run the database migration: 005_create_kiosk_chat_tables.sql',
            details: fetchError.message,
            code: fetchError.code
          },
          { status: 500 }
        );
      }

      // Check for RLS errors
      if (fetchError.message?.includes('row-level security') || fetchError.message?.includes('policy') || fetchError.code === '42501') {
        console.error('[Kiosk Chat] RLS policy error:', fetchError);
        return NextResponse.json(
          { 
            error: 'Row-level security policy error. Please check RLS policies or use SUPABASE_SERVICE_ROLE_KEY.',
            details: fetchError.message,
            code: fetchError.code
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { 
          error: `Failed to fetch chat history: ${fetchError.message || 'Unknown error'}`,
          details: fetchError.message,
          code: fetchError.code,
          hint: fetchError.hint
        },
        { status: 500 }
      );
    }

    console.log('[Kiosk Chat History] Successfully fetched', messages?.length || 0, 'messages');

    // Reverse to show oldest first
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({
      messages: sortedMessages,
    });
  } catch (error) {
    console.error('[Kiosk Chat History] Unexpected error:', error);
    console.error('[Kiosk Chat History] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}
