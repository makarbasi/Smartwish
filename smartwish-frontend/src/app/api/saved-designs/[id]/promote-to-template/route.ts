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
    const fullUrl = `${API_BASE_URL}/saved-designs/${id}/promote-to-template`;
    console.log('PromoteToTemplate API - User ID:', session.user.id);
    console.log('PromoteToTemplate API - Design ID:', id);
    console.log('PromoteToTemplate API - Full URL:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken || ''}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PromoteToTemplate API - Error:', data);
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: data.message || 'Failed to promote design', details: data.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error promoting design:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to promote design', details: errorMessage },
      { status: 500 }
    );
  }
}
