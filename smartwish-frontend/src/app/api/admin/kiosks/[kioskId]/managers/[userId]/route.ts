import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://smartwish.onrender.com";

/**
 * DELETE /api/admin/kiosks/:kioskId/managers/:userId
 * Unassign a manager from a kiosk
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kioskId: string; userId: string }> }
) {
  try {
    const { kioskId, userId } = await params;
    const session = await auth();

    if (!session?.user?.access_token) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/admin/kiosks/${kioskId}/assign/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to unassign manager" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error unassigning manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
