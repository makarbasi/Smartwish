import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy external images to avoid CORS issues with Pintura editor
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);
    
    // Only allow certain domains for security
    const allowedHosts = [
      'images.unsplash.com',
      'unsplash.com',
      'plus.unsplash.com',
      'images.pexels.com',
      'www.pexels.com',
      // Add your Supabase storage domain if needed
    ];

    if (!allowedHosts.some(host => parsedUrl.hostname.includes(host))) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SmartWish/1.0)',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
