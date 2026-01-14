import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/chat/send
 * Send a message from kiosk to admin
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, kioskId } = body;

    console.log('[Kiosk Chat Send] Received request:', { kioskId, messageLength: message?.length });

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('[Kiosk Chat Send] Invalid message:', { message, type: typeof message });
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
      console.error('[Kiosk Chat Send] Missing kioskId:', { body });
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    // Verify kiosk exists
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id, is_active')
      .eq('kiosk_id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      console.error('[Kiosk Chat Send] Kiosk not found:', { kioskId, error: kioskError });
      return NextResponse.json(
        { error: `Invalid kiosk ID: ${kioskId}` },
        { status: 400 }
      );
    }

    if (!kiosk.is_active) {
      return NextResponse.json(
        { error: 'Kiosk is not active' },
        { status: 403 }
      );
    }

    // Insert message
    const { data: chatMessage, error: insertError } = await supabase
      .from('kiosk_chat_messages')
      .insert({
        kiosk_id: kioskId,
        sender_type: 'kiosk',
        sender_id: null,
        message: message.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (insertError || !chatMessage) {
      console.error('[Kiosk Chat] Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    console.log(`[Kiosk Chat] Message sent from kiosk ${kioskId}: ${message.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      messageId: chatMessage.id,
    });
  } catch (error) {
    console.error('[Kiosk Chat] Error in send:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
