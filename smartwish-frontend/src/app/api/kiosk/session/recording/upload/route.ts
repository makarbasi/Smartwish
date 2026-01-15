import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * POST /api/kiosk/session/recording/upload
 * Upload recording video or thumbnail to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const kioskId = formData.get('kioskId') as string;
    const recordingId = formData.get('recordingId') as string;
    const type = formData.get('type') as string; // 'video' or 'thumbnail'

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Determine file path and bucket
    const bucket = 'session-recordings';
    const timestamp = Date.now();
    const isThumbnail = type === 'thumbnail';
    const extension = isThumbnail ? 'jpg' : (file.type.includes('webm') ? 'webm' : 'json');
    const folder = isThumbnail ? 'thumbnails' : 'videos';
    const fileName = `${folder}/${sessionId}_${timestamp}.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Recording] Upload error:', uploadError);
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('Bucket not found')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket not configured. Please create the "session-recordings" bucket in Supabase.',
            details: uploadError.message 
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Upload failed', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public/signed URL
    const { data: urlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 day expiry

    const storageUrl = urlData?.signedUrl || '';

    console.log('[Recording] Uploaded:', fileName, 'URL:', storageUrl.substring(0, 50) + '...');

    // Update recording record if we have recordingId
    if (recordingId && !isThumbnail) {
      await supabase
        .from('session_recordings')
        .update({
          storage_path: fileName,
          storage_url: storageUrl,
        })
        .eq('id', recordingId);
    } else if (recordingId && isThumbnail) {
      await supabase
        .from('session_recordings')
        .update({
          thumbnail_path: fileName,
          thumbnail_url: storageUrl,
        })
        .eq('id', recordingId);
    }

    return NextResponse.json({
      success: true,
      storagePath: fileName,
      storageUrl,
    });
  } catch (error) {
    console.error('[Recording] Error in upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

