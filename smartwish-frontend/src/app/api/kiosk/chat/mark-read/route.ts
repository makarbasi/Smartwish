import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/chat/mark-read
 * Mark messages as read for a kiosk
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kioskId, messageIds } = body;

    if (!kioskId) {
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    // Verify kiosk exists
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json(
        { error: 'Invalid kiosk ID' },
        { status: 400 }
      );
    }

    // If messageIds provided, mark specific messages as read
    // Otherwise, mark all admin messages for this kiosk as read
    let query = supabase
      .from('kiosk_chat_messages')
      .update({ is_read: true })
      .eq('kiosk_id', kioskId)
      .eq('sender_type', 'admin'); // Only mark admin messages as read

    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      query = query.in('id', messageIds);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error('[Kiosk Chat] Error marking messages as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Kiosk Chat] Error in mark-read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
