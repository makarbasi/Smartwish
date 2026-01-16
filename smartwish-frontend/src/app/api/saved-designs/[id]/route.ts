import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// PUT /api/saved-designs/[id] - Update a saved design
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string })
      .access_token;
    const body = await request.json();
    const { id } = await params;

    console.log("Update API - Design ID:", id);
    console.log("Update API - Request body:", JSON.stringify(body, null, 2));
    console.log("Update API - Access Token exists:", !!accessToken);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || ""}`,
      },
      body: JSON.stringify(body),
    });

    console.log("Update API - Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Update API - Error:", errorText);

      if (response.status === 404) {
        return NextResponse.json(
          { error: "Design not found" },
          { status: 404 }
        );
      }
      throw new Error(
        `Failed to update design: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error updating design:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update design", details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-designs/[id] - Delete a saved design
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string })
      .access_token;
    const { id } = await params;

    console.log("Delete API - Design ID:", id);
    console.log("Delete API - Access Token exists:", !!accessToken);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || ""}`,
      },
    });

    console.log("Delete API - Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Delete API - Error:", errorText);

      if (response.status === 404) {
        return NextResponse.json(
          { error: "Design not found" },
          { status: 404 }
        );
      }
      throw new Error(
        `Failed to delete design: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: result.message || "Design deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting design:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete design", details: errorMessage },
      { status: 500 }
    );
  }
}
