import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * POST /api/admin/screensavers/upload
 * Upload an HTML file or other asset to the screensavers bucket in Supabase Storage
 * 
 * Body: FormData with:
 * - file: The file to upload
 * - kioskId: (optional) The kiosk ID to organize files
 * - filename: (optional) Custom filename, defaults to original filename
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kioskId = formData.get('kioskId') as string | null;
    let filename = formData.get('filename') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'text/html',
      'video/mp4',
      'video/webm',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate filename if not provided
    if (!filename) {
      // Sanitize original filename
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      const ext = originalName.split('.').pop() || 'html';
      filename = `screensaver_${timestamp}.${ext}`;
    }

    // Build storage path
    // If kioskId is provided, organize by kiosk
    const storagePath = kioskId 
      ? `${kioskId}/${filename}`
      : filename;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabaseServer.storage
      .from('screensavers')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('[Screensavers Upload] Upload error:', error);
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseServer.storage
      .from('screensavers')
      .getPublicUrl(storagePath);

    console.log('[Screensavers Upload] File uploaded successfully:', {
      path: data.path,
      publicUrl: urlData.publicUrl,
    });

    return NextResponse.json({
      success: true,
      path: data.path,
      url: urlData.publicUrl,
      filename: filename,
    });
  } catch (error) {
    console.error('[Screensavers Upload] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
