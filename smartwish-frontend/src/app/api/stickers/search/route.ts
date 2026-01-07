import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/stickers/search
 * Proxy to backend sticker semantic search endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');
    const mode = searchParams.get('mode'); // 'semantic' | 'keyword' | 'hybrid'

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query is required', data: [], count: 0 },
        { status: 400 }
      );
    }

    const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com';
    const apiUrl = new URL('/stickers/search', base);

    // Add query parameters
    apiUrl.searchParams.set('q', query);
    
    if (category) {
      apiUrl.searchParams.set('category', category);
    }
    if (limit) {
      apiUrl.searchParams.set('limit', limit);
    }
    if (mode) {
      apiUrl.searchParams.set('mode', mode);
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache search results as heavily
      next: { revalidate: 60 },
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
        console.error('Upstream stickers search API returned invalid JSON. Sample:', text?.slice(0, 200));
        throw new Error('Invalid JSON from upstream stickers search API');
      }
    } else {
      const text = await response.text().catch(() => '');
      console.error('Upstream stickers search API returned non-JSON response. Sample:', text?.slice(0, 200));
      throw new Error('Non-JSON response from upstream stickers search API');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error searching stickers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search stickers', data: [], count: 0 },
      { status: 500 }
    );
  }
}
