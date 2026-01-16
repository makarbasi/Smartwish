import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Valid image types
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/admin/templates/upload
 * Upload an image to Supabase Storage for templates/stickers
 * 
 * FormData:
 *   - file: File (required)
 *   - type: 'card' | 'sticker' (required)
 *   - category: string (required) - determines storage path
 *   - imageType: string (optional) - 'cover' | 'inside' | 'image3' | 'image4' for cards
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const category = formData.get('category') as string;
    const imageType = formData.get('imageType') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!type || !['card', 'sticker'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "card" or "sticker"' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'png';
    
    let filename: string;
    let storagePath: string;

    if (type === 'sticker') {
      // Stickers go to: Stickers/{category}/{filename}
      filename = `sticker_${timestamp}_${randomId}.${extension}`;
      storagePath = `Stickers/${category}/${filename}`;
    } else {
      // Cards go to: templates/images/{category}/{imageType_}filename
      const prefix = imageType === 'inside' ? 'inside_' : '';
      filename = `${prefix}card_${timestamp}_${randomId}.${extension}`;
      storagePath = `templates/images/${category}/${filename}`;
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('smartwish-assets')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error('[Admin Templates] Upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('smartwish-assets')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    console.log(`[Admin Templates] Uploaded image: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: storagePath,
      filename,
    });
  } catch (error) {
    console.error('[Admin Templates] Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/templates/upload
 * Delete an image from Supabase Storage
 * 
 * Query params:
 *   - path: string (required) - full storage path to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Only allow deletion from templates/images or Stickers folders
    if (!path.startsWith('templates/images/') && !path.startsWith('Stickers/')) {
      return NextResponse.json(
        { error: 'Invalid path. Can only delete template or sticker images.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage
      .from('smartwish-assets')
      .remove([path]);

    if (error) {
      console.error('[Admin Templates] Delete error:', error);
      return NextResponse.json(
        { error: `Failed to delete: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('[Admin Templates] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
