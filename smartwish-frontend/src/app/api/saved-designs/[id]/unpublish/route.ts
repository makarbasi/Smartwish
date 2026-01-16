import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string }).access_token;
    const { id } = await params;

    console.log('Unpublish API - User ID:', session.user.id);
    console.log('Unpublish API - Design ID:', id);
    console.log('Unpublish API - Session user object:', JSON.stringify(session.user, null, 2));
    console.log('Unpublish API - Access Token exists:', !!accessToken);
    console.log('Unpublish API - Access Token (first 20 chars):', accessToken ? accessToken.substring(0, 20) + '...' : 'NO TOKEN');
    console.log('Unpublish API - API_BASE_URL:', API_BASE_URL);
    console.log('Unpublish API - Full URL:', `${API_BASE_URL}/saved-designs/${id}/unpublish`);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${id}/unpublish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken || ''}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unpublish API - Error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      throw new Error(`Failed to unpublish design: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    console.error('Error unpublishing design:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to unpublish design', details: errorMessage },
      { status: 500 }
    );
  }
}