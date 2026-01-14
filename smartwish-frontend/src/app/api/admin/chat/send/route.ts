import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/admin/chat/send
 * Send a message from admin to kiosk
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kioskId, message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'Message exceeds maximum length of 1000 characters' },
        { status: 400 }
      );
    }

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

    // Insert message
    const { data: chatMessage, error: insertError } = await supabase
      .from('kiosk_chat_messages')
      .insert({
        kiosk_id: kioskId,
        sender_type: 'admin',
        sender_id: session.user.id.toString(),
        message: message.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (insertError || !chatMessage) {
      console.error('[Admin Chat] Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    console.log(`[Admin Chat] Message sent to kiosk ${kioskId} from admin ${session.user.id}: ${message.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      messageId: chatMessage.id,
    });
  } catch (error) {
    console.error('[Admin Chat] Error in send:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
