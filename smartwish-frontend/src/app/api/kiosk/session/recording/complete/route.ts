import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/session/recording/complete
 * Finalize a recording with all metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recordingId, 
      sessionId,
      storageUrl, 
      thumbnailUrl, 
      duration, 
      fileSize,
      frameCount 
    } = body;

    if (!recordingId) {
      return NextResponse.json(
        { error: 'recordingId is required' },
        { status: 400 }
      );
    }

    // Update recording record with final data
    const { error: updateError } = await supabase
      .from('session_recordings')
      .update({
        status: 'completed',
        storage_url: storageUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: duration,
        file_size_bytes: fileSize,
        ended_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error('[Recording] Error completing recording:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete recording' },
        { status: 500 }
      );
    }

    // Ensure session has_recording flag is set
    if (sessionId) {
      await supabase
        .from('kiosk_sessions')
        .update({ has_recording: true })
        .eq('id', sessionId);
    }

    console.log('[Recording] Completed recording:', recordingId, {
      duration,
      fileSize,
      frameCount,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Recording] Error completing recording:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

