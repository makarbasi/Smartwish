import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/admin/chat/mark-read/[kioskId]
 * Mark all messages as read for a kiosk (admin-side)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
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
      return NextResponse.json(
        { error: 'Kiosk not found' },
        { status: 404 }
      );
    }

    // Mark all kiosk messages as read (admin has read them)
    const { error: updateError } = await supabase
      .from('kiosk_chat_messages')
      .update({ is_read: true })
      .eq('kiosk_id', kioskId)
      .eq('sender_type', 'kiosk'); // Only mark kiosk messages as read

    if (updateError) {
      console.error('[Admin Chat] Error marking messages as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Admin Chat] Error in mark-read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
