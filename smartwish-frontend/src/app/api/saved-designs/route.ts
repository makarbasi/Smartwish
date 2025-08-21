import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/saved-designs - Get all saved designs for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    console.log('Saved designs API - User ID:', session.user.id);
    console.log('Saved designs API - Access Token exists:', !!accessToken);

    const response = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Saved designs API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Saved designs API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const savedDesigns = await response.json();
    console.log('Saved designs API - Found designs:', savedDesigns.length);
    
    return NextResponse.json({
      success: true,
      data: savedDesigns,
    });

  } catch (error) {
    console.error('Error fetching saved designs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved designs' },
      { status: 500 }
    );
  }
}