import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * GET /api/admin/kiosks/[kioskId]/sessions/[sessionId]/recording
 * Proxy to backend - Get recording for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    // Check auth at frontend level
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Proxy to backend (backend trusts frontend auth check)
    const response = await fetch(`${BACKEND_URL}/admin/kiosks/${kioskId}/sessions/${sessionId}/recording`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 404 || data.recording === null) {
        return NextResponse.json({ recording: null });
      }
      console.error('[Recording] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    // Transform backend response to match frontend expected format
    const recording = data.recording;
    if (!recording) {
      return NextResponse.json({ recording: null });
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
 * Proxy to backend - Delete recording for a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; sessionId: string }> }
) {
  try {
    // Check auth at frontend level
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kioskId, sessionId } = await params;

    // Proxy to backend (backend trusts frontend auth check)
    const response = await fetch(`${BACKEND_URL}/admin/kiosks/${kioskId}/sessions/${sessionId}/recording`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Recording] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Recording] Deleted recording via backend for session:', sessionId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Recording] Error in DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

