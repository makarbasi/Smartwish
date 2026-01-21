import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/admin/screensavers/list
 * List all files in the screensavers bucket, optionally filtered by kioskId
 * 
 * Query params:
 * - kioskId: (optional) Filter files for a specific kiosk
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kioskId = searchParams.get('kioskId');

    // List files in the bucket
    const folder = kioskId || '';
    const { data, error } = await supabaseServer.storage
      .from('screensavers')
      .list(folder, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('[Screensavers List] Error:', error);
      return NextResponse.json(
        { error: `Failed to list files: ${error.message}` },
        { status: 500 }
      );
    }

    // Map files to include public URLs
    const files = data
      .filter(item => item.name !== '.emptyFolderPlaceholder') // Filter out placeholder
      .map(item => {
        const path = kioskId ? `${kioskId}/${item.name}` : item.name;
        const { data: urlData } = supabaseServer.storage
          .from('screensavers')
          .getPublicUrl(path);
        
        return {
          name: item.name,
          path: path,
          url: urlData.publicUrl,
          size: item.metadata?.size || 0,
          contentType: item.metadata?.mimetype || 'unknown',
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      });

    return NextResponse.json({
      success: true,
      files,
      kioskId: kioskId || null,
    });
  } catch (error) {
    console.error('[Screensavers List] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
