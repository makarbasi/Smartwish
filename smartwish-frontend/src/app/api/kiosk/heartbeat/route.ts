import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/heartbeat
 * Kiosk device heartbeat - updates last_seen timestamp
 * This endpoint is called periodically by activated kiosk devices to indicate they're online
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kioskId } = body; // This is the UUID (id field), not kiosk_id string

    if (!kioskId) {
      return NextResponse.json(
        { error: 'kioskId is required' },
        { status: 400 }
      );
    }

    console.log(`[Heartbeat] Received heartbeat from kiosk: ${kioskId}`);

    // Verify the kiosk exists and get its kiosk_id string
    const { data: kiosk, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('id, kiosk_id')
      .eq('id', kioskId)
      .single();

    if (kioskError || !kiosk) {
      console.error(`[Heartbeat] Kiosk not found: ${kioskId}`, kioskError);
      return NextResponse.json(
        { error: 'Invalid kiosk ID' },
        { status: 400 }
      );
    }

    // Update the kiosk's config with last_heartbeat timestamp
    // Store it in the config JSONB field
    const { data: currentKiosk, error: fetchError } = await supabase
      .from('kiosk_configs')
      .select('config')
      .eq('id', kioskId)
      .single();

    if (fetchError || !currentKiosk) {
      console.error('[Heartbeat] Error fetching kiosk config:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch kiosk config' },
        { status: 500 }
      );
    }

    // Update config with heartbeat timestamp
    const updatedConfig = {
      ...(currentKiosk.config || {}),
      lastHeartbeat: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('kiosk_configs')
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kioskId);

    if (updateError) {
      console.error('[Heartbeat] Error updating heartbeat:', updateError);
      return NextResponse.json(
        { error: 'Failed to update heartbeat' },
        { status: 500 }
      );
    }

    console.log(`[Heartbeat] ✅ Updated heartbeat for kiosk ${kiosk.kiosk_id} (${kioskId})`);

    return NextResponse.json({
      success: true,
      kioskId: kiosk.kiosk_id,
      timestamp: updatedConfig.lastHeartbeat,
    });
  } catch (error) {
    console.error('[Heartbeat] Error in heartbeat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
