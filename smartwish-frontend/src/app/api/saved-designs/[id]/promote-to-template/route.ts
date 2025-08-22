import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// POST /api/saved-designs/[id]/promote-to-template - Promote a saved design directly using fallback RPC
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = context.params;
    const accessToken = (session.user as { access_token?: string }).access_token;
    console.log('Promote-to-template API - Design ID:', id);

    // Call backend promote endpoint first (bypasses missing primary RPC)
    const response = await fetch(`${API_BASE_URL}/saved-designs/${id}/promote-to-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Promote-to-template API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Promote-to-template API - Error:', errorText);
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      throw new Error(`Failed to promote design: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('Error promoting design to template:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to promote design', details: msg }, { status: 500 });
  }
}
