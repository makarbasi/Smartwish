import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// POST /api/saved-designs/[id]/duplicate - Duplicate a saved design
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const body = await request.json();
    const { id } = await params;
    
    console.log('Duplicate API - Design ID:', id);
    console.log('Duplicate API - Body:', body);
    console.log('Duplicate API - Session user object:', JSON.stringify(session.user, null, 2));
    console.log('Duplicate API - Access Token exists:', !!accessToken);
    console.log('Duplicate API - Access Token (first 20 chars):', accessToken ? accessToken.substring(0, 20) + '...' : 'NO TOKEN');
    console.log('Duplicate API - API_BASE_URL:', API_BASE_URL);

    // Use the backend duplicate endpoint
    const response = await fetch(`${API_BASE_URL}/saved-designs/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(body), // Pass the updated data including title and images
    });

    console.log('Duplicate API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Duplicate API - Error response text:', errorText);
      console.error('Duplicate API - Error response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      throw new Error(`Failed to duplicate design: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Duplicate API - Success response text:', responseText);
    
    if (!responseText) {
      console.error('Duplicate API - Empty response received');
      throw new Error('Empty response from backend');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Duplicate API - JSON parse error:', parseError);
      console.error('Duplicate API - Response text that failed to parse:', responseText);
      throw new Error('Invalid JSON response from backend');
    }
    
    return NextResponse.json({
      success: true,
      data: result.design,
      message: result.message || 'Design duplicated successfully',
    });

  } catch (error) {
    console.error('Error duplicating design:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to duplicate design', details: errorMessage },
      { status: 500 }
    );
  }
}