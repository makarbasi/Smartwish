import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string }).access_token;

    console.log('Published User API - User ID:', session.user.id);
    console.log('Published User API - Session user object:', JSON.stringify(session.user, null, 2));
    console.log('Published User API - Access Token exists:', !!accessToken);
    console.log('Published User API - Access Token (first 20 chars):', accessToken ? accessToken.substring(0, 20) + '...' : 'NO TOKEN');
    console.log('Published User API - API_BASE_URL:', API_BASE_URL);
    console.log('Published User API - Full URL:', `${API_BASE_URL}/saved-designs/published/user`);

    const response = await fetch(`${API_BASE_URL}/saved-designs/published/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken || ''}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Published User API - Error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Published designs not found' }, { status: 404 });
      }
      throw new Error(`Failed to fetch published designs: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Error fetching published designs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch published designs', details: errorMessage },
      { status: 500 }
    );
  }
}