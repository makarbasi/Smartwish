import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/stickers/categories
 * Proxy to backend sticker categories endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Use local backend in development, remote in production
    const base = process.env.NEXT_PUBLIC_API_BASE ?? 
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://smartwish.onrender.com');
    const apiUrl = new URL('/stickers/categories', base);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sticker categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories', data: [] },
      { status: 500 }
    );
  }
}
