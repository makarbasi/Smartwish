import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * PATCH /api/kiosk/session/recording/status
 * Update the status of a recording
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, status, errorMessage } = body;

    if (!recordingId) {
      return NextResponse.json(
        { error: 'recordingId is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['recording', 'processing', 'uploading', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (status === 'failed' || status === 'completed') {
      updateData.ended_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('session_recordings')
      .update(updateData)
      .eq('id', recordingId);

    if (updateError) {
      console.error('[Recording] Error updating status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      );
    }

    console.log('[Recording] Updated recording status:', recordingId, 'to', status);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Recording] Error updating status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

