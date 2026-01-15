import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/recordings
 * List all recordings across all kiosks with filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const kioskId = searchParams.get('kioskId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('session_recordings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (kioskId) {
      query = query.eq('kiosk_id', kioskId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59');
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: recordings, error: recordingsError, count } = await query;

    if (recordingsError) {
      console.error('Error fetching recordings:', recordingsError);
      
      // Check if table doesn't exist
      if (recordingsError.message?.includes('relation') && recordingsError.message?.includes('does not exist')) {
        return NextResponse.json({
          recordings: [],
          total: 0,
          page,
          pageSize,
          totalSize: 0,
          notice: 'Session recordings table has not been created yet. Please run the database migration.',
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch recordings' },
        { status: 500 }
      );
    }

    // Get kiosk names for display
    const kioskIds = [...new Set((recordings || []).map(r => r.kiosk_id))];
    let kioskMap: Record<string, string> = {};
    
    if (kioskIds.length > 0) {
      const { data: kiosks } = await supabase
        .from('kiosk_configs')
        .select('kiosk_id, name')
        .in('kiosk_id', kioskIds);
      
      kioskMap = (kiosks || []).reduce((acc, k) => {
        acc[k.kiosk_id] = k.name;
        return acc;
      }, {} as Record<string, string>);
    }

    // Calculate total storage size
    const { data: allRecordings } = await supabase
      .from('session_recordings')
      .select('file_size_bytes');
    
    const totalSize = (allRecordings || []).reduce(
      (sum, r) => sum + (r.file_size_bytes || 0), 
      0
    );

    // Transform recordings
    const transformedRecordings = (recordings || []).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      kioskId: r.kiosk_id,
      kioskName: kioskMap[r.kiosk_id] || r.kiosk_id,
      storageUrl: r.storage_url,
      thumbnailUrl: r.thumbnail_url,
      duration: r.duration_seconds,
      fileSize: r.file_size_bytes,
      format: r.format || 'webm',
      resolution: r.resolution || '1280x720',
      frameRate: r.frame_rate || 1,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      recordings: transformedRecordings,
      total: count || 0,
      page,
      pageSize,
      totalSize,
    });
  } catch (error) {
    console.error('Error in recordings list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/recordings
 * Delete multiple recordings
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recordingIds } = body;

    if (!recordingIds || !Array.isArray(recordingIds) || recordingIds.length === 0) {
      return NextResponse.json(
        { error: 'recordingIds array is required' },
        { status: 400 }
      );
    }

    // Get recordings to find storage paths
    const { data: recordings, error: fetchError } = await supabase
      .from('session_recordings')
      .select('id, session_id, storage_path, thumbnail_path')
      .in('id', recordingIds);

    if (fetchError || !recordings) {
      return NextResponse.json(
        { error: 'Failed to fetch recordings' },
        { status: 500 }
      );
    }

    // Delete files from storage
    const filesToDelete: string[] = [];
    recordings.forEach((r) => {
      if (r.storage_path) filesToDelete.push(r.storage_path);
      if (r.thumbnail_path) filesToDelete.push(r.thumbnail_path);
    });

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('session-recordings')
        .remove(filesToDelete);

      if (storageError) {
        console.error('Error deleting files:', storageError);
        // Continue to delete database records even if storage deletion fails
      }
    }

    // Delete recording records
    const { error: deleteError } = await supabase
      .from('session_recordings')
      .delete()
      .in('id', recordingIds);

    if (deleteError) {
      console.error('Error deleting recording records:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete recordings' },
        { status: 500 }
      );
    }

    // Update sessions to remove has_recording flag
    const sessionIds = [...new Set(recordings.map(r => r.session_id))];
    for (const sessionId of sessionIds) {
      // Check if session has any remaining recordings
      const { count } = await supabase
        .from('session_recordings')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (count === 0) {
        await supabase
          .from('kiosk_sessions')
          .update({ has_recording: false })
          .eq('id', sessionId);
      }
    }

    console.log('[Recordings] Deleted', recordingIds.length, 'recordings');

    return NextResponse.json({
      success: true,
      deletedCount: recordingIds.length,
    });
  } catch (error) {
    console.error('Error in recordings delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

