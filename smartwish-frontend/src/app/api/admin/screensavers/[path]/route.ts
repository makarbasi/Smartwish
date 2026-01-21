import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * DELETE /api/admin/screensavers/[path]
 * Delete a file from the screensavers bucket in Supabase Storage
 * 
 * The path can include subdirectories (e.g., kioskId/filename.html)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path } = await params;
    
    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    // Decode the path (it may be URL encoded)
    const decodedPath = decodeURIComponent(path);

    console.log('[Screensavers Delete] Deleting file:', decodedPath);

    // Delete from Supabase Storage
    const { error } = await supabaseServer.storage
      .from('screensavers')
      .remove([decodedPath]);

    if (error) {
      console.error('[Screensavers Delete] Delete error:', error);
      return NextResponse.json(
        { error: `Delete failed: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[Screensavers Delete] File deleted successfully:', decodedPath);

    return NextResponse.json({
      success: true,
      path: decodedPath,
    });
  } catch (error) {
    console.error('[Screensavers Delete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/screensavers/[path]
 * Get the public URL for a file in the screensavers bucket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path } = await params;
    
    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    // Decode the path (it may be URL encoded)
    const decodedPath = decodeURIComponent(path);

    // Get public URL
    const { data } = supabaseServer.storage
      .from('screensavers')
      .getPublicUrl(decodedPath);

    return NextResponse.json({
      success: true,
      path: decodedPath,
      url: data.publicUrl,
    });
  } catch (error) {
    console.error('[Screensavers Get] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
