import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com';
    const apiUrl = new URL('/stickers', base);

    // Add query parameters
    if (query) {
      apiUrl.searchParams.set('q', query);
    }
    if (category) {
      apiUrl.searchParams.set('category', category);
    }
    if (limit) {
      apiUrl.searchParams.set('limit', limit);
    }
    if (offset) {
      apiUrl.searchParams.set('offset', offset);
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text().catch(() => '');
        console.error('Upstream stickers API returned invalid JSON. Sample:', text?.slice(0, 200));
        throw new Error('Invalid JSON from upstream stickers API');
      }
    } else {
      const text = await response.text().catch(() => '');
      console.error('Upstream stickers API returned non-JSON response. Sample:', text?.slice(0, 200));
      throw new Error('Non-JSON response from upstream stickers API');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stickers data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stickers data', data: [], total: 0 },
      { status: 500 }
    );
  }
}
