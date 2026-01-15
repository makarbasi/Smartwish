import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';
import { getServerSession } from 'next-auth';

/**
 * GET /api/admin/kiosks/[kioskId]/sessions/[sessionId]/recording
 * Get recording for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Get recording for session
    const { data: recording, error } = await supabase
      .from('session_recordings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No recording found
        return NextResponse.json({ recording: null });
      }
      console.error('[Recording] Error fetching recording:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recording' },
        { status: 500 }
      );
    }

    // Refresh signed URL if needed
    if (recording.storage_path && (!recording.storage_url || isUrlExpired(recording.storage_url))) {
      const { data: urlData } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(recording.storage_path, 60 * 60 * 24); // 24 hour expiry

      if (urlData?.signedUrl) {
        recording.storage_url = urlData.signedUrl;
        
        // Update in database
        await supabase
          .from('session_recordings')
          .update({ storage_url: urlData.signedUrl })
          .eq('id', recording.id);
      }
    }

    // Refresh thumbnail URL if needed
    if (recording.thumbnail_path && (!recording.thumbnail_url || isUrlExpired(recording.thumbnail_url))) {
      const { data: thumbData } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(recording.thumbnail_path, 60 * 60 * 24);

      if (thumbData?.signedUrl) {
        recording.thumbnail_url = thumbData.signedUrl;
        
        await supabase
          .from('session_recordings')
          .update({ thumbnail_url: thumbData.signedUrl })
          .eq('id', recording.id);
      }
    }

    return NextResponse.json({
      recording: {
        id: recording.id,
        sessionId: recording.session_id,
        kioskId: recording.kiosk_id,
        storageUrl: recording.storage_url,
        thumbnailUrl: recording.thumbnail_url,
        duration: recording.duration_seconds,
        fileSize: recording.file_size_bytes,
        format: recording.format,
        resolution: recording.resolution,
        frameRate: recording.frame_rate,
        status: recording.status,
        startedAt: recording.started_at,
        endedAt: recording.ended_at,
        createdAt: recording.created_at,
      },
    });
  } catch (error) {
    console.error('[Recording] Error in GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/kiosks/[kioskId]/sessions/[sessionId]/recording
 * Delete recording for a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Get recording to find storage paths
    const { data: recording, error: fetchError } = await supabase
      .from('session_recordings')
      .select('id, storage_path, thumbnail_path')
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Delete files from storage
    const filesToDelete: string[] = [];
    if (recording.storage_path) {
      filesToDelete.push(recording.storage_path);
    }
    if (recording.thumbnail_path) {
      filesToDelete.push(recording.thumbnail_path);
    }

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('session-recordings')
        .remove(filesToDelete);

      if (storageError) {
        console.error('[Recording] Error deleting files:', storageError);
        // Continue anyway to delete database record
      }
    }

    // Delete recording record
    const { error: deleteError } = await supabase
      .from('session_recordings')
      .delete()
      .eq('id', recording.id);

    if (deleteError) {
      console.error('[Recording] Error deleting record:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete recording' },
        { status: 500 }
      );
    }

    // Update session to indicate no recording
    await supabase
      .from('kiosk_sessions')
      .update({ has_recording: false })
      .eq('id', sessionId);

    console.log('[Recording] Deleted recording:', recording.id, 'for session:', sessionId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Recording] Error in DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to check if a signed URL might be expired
function isUrlExpired(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');
    if (!token) return true;

    // Decode JWT payload (middle part)
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    if (!exp) return true;

    // Check if expired (with 5 minute buffer)
    return Date.now() / 1000 > exp - 300;
  } catch {
    return true;
  }
}

