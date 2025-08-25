import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        // Get the session to check authentication
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Authentication required" },
                { status: 401 }
            );
        }

        const accessToken = (session.user as { access_token?: string }).access_token;

        const body = await request.json();
        const { cardId, recipientEmail, message } = body;

        // Validate required fields
        if (!cardId || !recipientEmail) {
            return NextResponse.json(
                { success: false, error: "Card ID and recipient email are required" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return NextResponse.json(
                { success: false, error: "Invalid email address format" },
                { status: 400 }
            );
        }

        // Get the backend URL from environment variables
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

        // Forward the request to the backend e-card service
        const response = await fetch(`${backendUrl}/api/ecard/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken || ''}`, // Forward the auth token
            },
            body: JSON.stringify({
                cardId,
                recipientEmail,
                message: message || "",
                senderName: session.user?.name || "A SmartWish user",
                senderEmail: session.user?.email || "",
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Backend E-Card API error:", errorData);
            return NextResponse.json(
                { success: false, error: errorData.error || "Failed to send E-Card" },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log("✅ E-Card sent successfully:", result);

        return NextResponse.json({
            success: true,
            shareId: result.shareId,
            message: "E-Card sent successfully!",
        });

    } catch (error) {
        console.error("❌ Error in E-Card API route:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
