import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/chat/kiosks
 * List all kiosks with active chats and unread counts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all kiosks with chat activity
    const { data: kiosksWithChats, error: kiosksError } = await supabase
      .from('kiosk_chat_messages')
      .select('kiosk_id')
      .order('created_at', { ascending: false });

    if (kiosksError) {
      console.error('[Admin Chat] Error fetching kiosks with chats:', kiosksError);
      return NextResponse.json(
        { error: 'Failed to fetch kiosks' },
        { status: 500 }
      );
    }

    // Get unique kiosk IDs
    const uniqueKioskIds = [...new Set((kiosksWithChats || []).map((m: any) => m.kiosk_id))];

    if (uniqueKioskIds.length === 0) {
      return NextResponse.json({ kiosks: [] });
    }

    // Get kiosk configs
    const { data: kioskConfigs, error: configError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id, name, store_id')
      .in('kiosk_id', uniqueKioskIds);

    if (configError) {
      console.error('[Admin Chat] Error fetching kiosk configs:', configError);
      return NextResponse.json(
        { error: 'Failed to fetch kiosk configs' },
        { status: 500 }
      );
    }

    // Get unread counts and last message for each kiosk
    const kiosksWithStats = await Promise.all(
      uniqueKioskIds.map(async (kioskId) => {
        // Get unread count (kiosk messages that admin hasn't read)
        const { count: unreadCount } = await supabase
          .from('kiosk_chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('kiosk_id', kioskId)
          .eq('sender_type', 'kiosk')
          .eq('is_read', false);

        // Get last message
        const { data: lastMessage } = await supabase
          .from('kiosk_chat_messages')
          .select('message, created_at, sender_type')
          .eq('kiosk_id', kioskId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const kioskConfig = kioskConfigs?.find((k: any) => k.kiosk_id === kioskId);

        return {
          kioskId,
          name: kioskConfig?.name || kioskId,
          storeId: kioskConfig?.store_id || null,
          unreadCount: unreadCount || 0,
          lastMessage: lastMessage
            ? {
                message: lastMessage.message,
                createdAt: lastMessage.created_at,
                senderType: lastMessage.sender_type,
              }
            : null,
        };
      })
    );

    // Sort by last message time (most recent first)
    kiosksWithStats.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || '';
      const bTime = b.lastMessage?.createdAt || '';
      return bTime.localeCompare(aTime);
    });

    return NextResponse.json({ kiosks: kiosksWithStats });
  } catch (error) {
    console.error('[Admin Chat] Error in kiosks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
