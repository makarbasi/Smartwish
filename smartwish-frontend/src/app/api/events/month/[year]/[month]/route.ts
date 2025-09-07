import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/events/month/[year]/[month] - Get events for a specific month
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string }).access_token;
    const { year, month } = await params;

    // Validate year and month
    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    if (isNaN(yearInt) || yearInt < 1900 || yearInt > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    }

    console.log('Frontend API - Fetching events for:', { year: yearInt, month: monthInt });

    const response = await fetch(`${API_BASE_URL}/api/events/month/${year}/${month}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Frontend API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}