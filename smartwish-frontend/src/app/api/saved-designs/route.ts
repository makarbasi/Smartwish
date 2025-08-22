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
    console.log('Saved designs API - API_BASE_URL:', API_BASE_URL);

    // First try a simple health check
    console.log('Testing backend connectivity...');
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Health check response:', healthResponse.status);
    } catch (healthError) {
      console.error('Health check failed:', healthError);
    }

    // Now try the actual request
    console.log('Making saved-designs request...');
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

// POST /api/saved-designs - Create a new saved design
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const body = await request.json();

    console.log('Create saved design API - User ID:', session.user.id);
    console.log('Create saved design API - Body:', body);

    const response = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(body),
    });

    console.log('Create saved design API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create saved design API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const newDesign = await response.json();
    console.log('Create saved design API - Created successfully');
    
    return NextResponse.json({
      success: true,
      data: newDesign,
    });

  } catch (error) {
    console.error('Error creating saved design:', error);
    return NextResponse.json(
      { error: 'Failed to create saved design' },
      { status: 500 }
    );
  }
}