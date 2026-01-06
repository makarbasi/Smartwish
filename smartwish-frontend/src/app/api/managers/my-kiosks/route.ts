import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

/**
 * GET /api/managers/my-kiosks
 * Get kiosks assigned to the logged-in manager
 */
export async function GET(request: NextRequest) {
  try {
    // Check both cases for header (case-insensitive fallback)
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');

    if (!authHeader) {
      console.error('[my-kiosks] No Authorization header found');
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Log token info (first/last 10 chars for debugging)
    const tokenPart = authHeader.replace('Bearer ', '');
    console.log('[my-kiosks] Token received:', tokenPart.substring(0, 20) + '...' + tokenPart.substring(tokenPart.length - 10));
    console.log('[my-kiosks] Fetching from:', `${API_BASE}/managers/my-kiosks`);
    
    const response = await fetch(`${API_BASE}/managers/my-kiosks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[my-kiosks] Non-JSON response:', text);
      return NextResponse.json(
        { error: text || 'Backend returned non-JSON response' },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('[my-kiosks] Error response:', data);
      return NextResponse.json(
        { error: data.message || "Failed to fetch kiosks" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching kiosks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
