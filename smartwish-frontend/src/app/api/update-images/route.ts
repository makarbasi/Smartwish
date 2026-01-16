import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UpdateImageRequest {
  supabaseUrl: string;
  newImageBlob: string; // base64 data URL
  designId?: string; // Optional design ID to limit updates to specific design
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const body: UpdateImageRequest = await request.json();
    
    const { supabaseUrl, newImageBlob, designId } = body;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL is required' },
        { status: 400 }
      );
    }

    if (!newImageBlob) {
      return NextResponse.json(
        { error: 'New image blob is required' },
        { status: 400 }
      );
    }

    console.log('Update Images API - User ID:', session.user.id);
    console.log('Update Images API - API_BASE_URL:', API_BASE_URL);
    
    const response = await fetch(`${API_BASE_URL}/saved-designs/update-supabase-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify({
        supabaseUrl,
        newImageData: newImageBlob,
        designId  // Forward the design ID to the backend
      })
    });

    console.log('Update Images API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Update Images API - Backend error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Image content updated successfully',
      supabaseUrl: result.url || supabaseUrl
    });
    
  } catch (error) {
    console.error('Update Images API - Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
