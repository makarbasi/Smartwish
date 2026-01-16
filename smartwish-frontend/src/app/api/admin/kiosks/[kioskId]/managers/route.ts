import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://smartwish.onrender.com";

/**
 * GET /api/admin/kiosks/:kioskId/managers
 * Get all managers assigned to a kiosk
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    const { kioskId } = await params;
    const session = await auth();

    if (!session?.user?.access_token) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/admin/kiosks/${kioskId}/managers`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch managers" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching kiosk managers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/kiosks/:kioskId/managers
 * Assign a manager to a kiosk
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  try {
    const { kioskId } = await params;
    const session = await auth();

    if (!session?.user?.access_token) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/admin/kiosks/${kioskId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to assign manager" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error assigning manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
