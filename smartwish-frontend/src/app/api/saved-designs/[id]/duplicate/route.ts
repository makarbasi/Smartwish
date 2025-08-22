import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// POST /api/saved-designs/[id]/duplicate - Duplicate a saved design
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    // Body is optional for duplication – safely parse only if present
    let body: any = {};
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        const raw = await request.text();
        if (raw && raw.trim().length > 0) {
          body = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn('Duplicate API - ignoring invalid JSON body');
      body = {};
    }
    
    console.log('Duplicate API - Design ID:', params.id);
    console.log('Duplicate API - Body:', body);
    console.log('Duplicate API - Access Token exists:', !!accessToken);

    // Use the backend duplicate endpoint
    const response = await fetch(`${API_BASE_URL}/saved-designs/${params.id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(body), // Safe (may be "{}")
    });

    console.log('Duplicate API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Duplicate API - Error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      throw new Error(`Failed to duplicate design: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      data: result.design,
      message: result.message || 'Design duplicated successfully',
    });

  } catch (error) {
    console.error('Error duplicating design:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate design', details: error.message },
      { status: 500 }
    );
  }
}