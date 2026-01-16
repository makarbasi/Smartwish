import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        // Debug environment variables first
        console.log('🔍 API_URL from env:', process.env.API_URL);
        console.log('🔍 NEXT_PUBLIC_API_URL from env:', process.env.NEXT_PUBLIC_API_URL);
        
        // Get the session to check authentication
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Authentication required" },
                { status: 401 }
            );
        }

        const accessToken = (session.user as { access_token?: string }).access_token;
        console.log('🔑 Access token available:', !!accessToken);
        console.log('🔑 Access token length:', accessToken?.length || 0);
        
        // Check if access token is available
        if (!accessToken) {
            console.log('❌ No access token found in session');
            return NextResponse.json(
                { success: false, error: "Authentication token missing. Please log in again." },
                { status: 401 }
            );
        }

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

        // Get the backend URL from environment variables (server-side)
        const backendUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        console.log('🔍 API_URL from env:', process.env.API_URL);
        console.log('🔍 NEXT_PUBLIC_API_URL from env:', process.env.NEXT_PUBLIC_API_URL);
        console.log('🔍 Final backend URL:', backendUrl);

        // Forward the request to the backend e-card service with timeout and retry
        let response;
        let lastError;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`🔄 Attempting to send E-Card (attempt ${attempt}/3) to ${backendUrl}/api/ecard/send`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                
                response = await fetch(`${backendUrl}/api/ecard/send`, {
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
                    signal: controller.signal,
                });
                
                clearTimeout(timeoutId);
                console.log(`✅ Backend responded with status: ${response.status}`);
                break; // Success, exit retry loop
                
            } catch (error: any) {
                lastError = error;
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                // Check for specific connection errors
                if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
                    console.log(`🔌 Connection error detected: ${error.code}`);
                }
                
                if (attempt === 3) {
                    console.log('❌ All retry attempts failed');
                    break;
                }
                
                // Wait before retrying (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // If we get here without a response, all retries failed
        if (!response) {
            console.log('❌ All retry attempts failed, no response received');
            
            // Provide specific error messages based on error type
            let errorMessage = 'Failed to send E-Card';
            let statusCode = 500;
            
            if (lastError?.code === 'ECONNRESET') {
                errorMessage = 'Connection was reset by the backend server. This may be due to an invalid authentication token or server overload.';
                statusCode = 503; // Service Unavailable
            } else if (lastError?.code === 'ECONNREFUSED') {
                errorMessage = 'Unable to connect to the backend server. Please check if the server is running.';
                statusCode = 503; // Service Unavailable
            } else if (lastError?.message?.includes('fetch failed')) {
                errorMessage = 'Network request failed. Please check your internet connection and try again.';
                statusCode = 503; // Service Unavailable
            } else {
                errorMessage = `Failed to send E-Card: ${lastError?.message || 'Unknown error'}`;
            }
            
            return NextResponse.json(
                { success: false, error: errorMessage },
                { status: statusCode }
            );
        }

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
