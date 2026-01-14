import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/chat/messages/[kioskId]
 * Get chat history for a specific kiosk
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const before = searchParams.get('before'); // message ID for pagination

    // Verify kiosk exists
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id, name')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json(
        { error: 'Kiosk not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from('kiosk_chat_messages')
      .select('*')
      .eq('kiosk_id', kioskId)
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

    if (fetchError) {
      console.error('[Admin Chat] Error fetching messages:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Reverse to show oldest first
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({
      kiosk: {
        kioskId: kiosk.kiosk_id,
        name: kiosk.name,
      },
      messages: sortedMessages,
    });
  } catch (error) {
    console.error('[Admin Chat] Error in messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
