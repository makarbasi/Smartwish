import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/sales-rep/my-kiosks`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sales rep kiosks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kiosks' },
      { status: 500 }
    );
  }
}
