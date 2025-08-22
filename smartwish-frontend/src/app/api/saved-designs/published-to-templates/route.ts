import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/saved-designs/published-to-templates - Get current user's designs that are published to sw_templates
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const accessToken = (session.user as { access_token?: string }).access_token;
    console.log('Published-to-templates list API - User ID:', session.user.id);

    const response = await fetch(`${API_BASE_URL}/saved-designs/published-to-templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Published-to-templates list API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Published-to-templates list API - Error:', errorText);
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const publishedDesigns = await response.json();
    return NextResponse.json({ success: true, data: publishedDesigns });
  } catch (error: unknown) {
    console.error('Error fetching published-to-templates designs:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch published designs', details: msg }, { status: 500 });
  }
}
