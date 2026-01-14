import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * POST /api/managers/complete-setup
 * Complete manager account setup (set password)
 * Proxies to backend: POST /managers/complete-setup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.token || !body.password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE}/managers/complete-setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: body.token,
        password: body.password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to complete setup' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error completing manager setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
