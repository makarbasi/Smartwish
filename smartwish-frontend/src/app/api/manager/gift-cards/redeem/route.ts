import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

/**
 * POST /api/manager/gift-cards/redeem
 * Redeem (deduct) from a gift card
 * Proxies to backend: POST /manager/gift-cards/redeem
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      console.error('[Manager Redeem] No access token in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
      console.log('[Manager Redeem] Request body received:', {
        cardId: body.cardId,
        amount: body.amount,
        hasPin: !!body.pin,
        hasDescription: !!body.description,
      });
    } catch (bodyError: any) {
      console.error('[Manager Redeem] Error parsing request body:', bodyError);
      return NextResponse.json({
        error: 'Invalid request body',
        message: bodyError?.message || 'Failed to parse JSON',
        details: { type: 'body_parse_error' }
      }, { status: 400 });
    }

    // Validate required fields
    if (!body.cardId || !body.pin || !body.amount) {
      return NextResponse.json(
        { error: 'Card ID, PIN, and amount are required' },
        { status: 400 }
      );
    }

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    console.log('[Manager Redeem] Redeeming gift card:', {
      cardId: body.cardId,
      amount: body.amount,
      hasPin: !!body.pin,
      hasDescription: !!body.description,
    });

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/manager/gift-cards/redeem`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      console.log('[Manager Redeem] Backend response status:', response.status, response.statusText);
    } catch (fetchError: any) {
      console.error('[Manager Redeem] Fetch error:', fetchError);
      throw fetchError; // Re-throw to be caught by outer catch
    }

    const contentType = response.headers.get('content-type');
    console.log('[Manager Redeem] Response content-type:', contentType);
    
    // Read response body once
    let responseText: string;
    try {
      responseText = await response.text();
    } catch (readError: any) {
      console.error('[Manager Redeem] Error reading response body:', readError);
      return NextResponse.json(
        { error: 'Failed to read backend response', message: readError?.message },
        { status: 500 }
      );
    }
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[Manager Redeem] Non-JSON response from backend:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Backend returned non-JSON response', details: responseText.substring(0, 200) },
        { status: response.status || 500 }
      );
    }

    let data: any;
    try {
      console.log('[Manager Redeem] Raw response text:', responseText.substring(0, 500));
      data = JSON.parse(responseText);
      console.log('[Manager Redeem] Parsed backend response:', data);
    } catch (parseError: any) {
      console.error('[Manager Redeem] Error parsing backend response:', parseError);
      console.error('[Manager Redeem] Response status was:', response.status);
      console.error('[Manager Redeem] Response text was:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON response from backend', message: parseError?.message },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('[Manager Redeem] Backend error response (status:', response.status, '):', data);
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to redeem gift card', details: data },
        { status: response.status || 500 }
      );
    }

    // Ensure response has expected structure
    if (!data.success && !data.newBalance) {
      console.warn('[Manager Redeem] Unexpected response structure:', data);
      // Still return the data - it might have succeeded even if structure is unexpected
    }

    // Log success
    console.log('[Manager Redeem] ✅ Redemption successful:', {
      amountRedeemed: data.amountRedeemed,
      newBalance: data.newBalance,
      cardStatus: data.cardStatus,
    });

    try {
      return NextResponse.json(data);
    } catch (jsonError: any) {
      console.error('[Manager Redeem] Error serializing response:', jsonError);
      // If we can't serialize, return a simplified response
      return NextResponse.json({
        success: true,
        newBalance: data.newBalance,
        amountRedeemed: data.amountRedeemed,
        cardStatus: data.cardStatus,
      });
    }
  } catch (error: any) {
    // Log all errors for debugging
    console.error('[Manager Redeem] ========== EXCEPTION IN REDEEM ROUTE ==========');
    console.error('[Manager Redeem] Error object:', error);
    console.error('[Manager Redeem] Error type:', error?.constructor?.name);
    console.error('[Manager Redeem] Error name:', error?.name);
    console.error('[Manager Redeem] Error message:', error?.message);
    console.error('[Manager Redeem] Error code:', error?.code);
    if (error?.stack) {
      console.error('[Manager Redeem] Error stack:', error?.stack);
    }
    console.error('[Manager Redeem] ==============================================');
    
    // Handle network/connection errors
    if (error?.message?.includes('fetch') || error?.code === 'ECONNREFUSED' || error?.name === 'TypeError') {
      console.error('[Manager Redeem] Detected network error');
      return NextResponse.json({ 
        error: 'Failed to connect to backend',
        message: error?.message || 'Network error',
        details: {
          type: 'network',
          code: error?.code,
          name: error?.name
        }
      }, { status: 503 });
    }
    
    // Handle JSON parsing errors
    if (error?.message?.includes('JSON') || error?.name === 'SyntaxError') {
      console.error('[Manager Redeem] Detected JSON parsing error');
      return NextResponse.json({ 
        error: 'Invalid response from backend',
        message: error?.message,
        details: {
          type: 'parsing',
          name: error?.name
        }
      }, { status: 502 });
    }
    
    // Generic error handler - include more details in development
    const errorDetails: any = {
      type: error?.constructor?.name || 'Unknown',
      name: error?.name,
      message: error?.message || 'Unknown error',
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorDetails.stack = error?.stack;
      errorDetails.fullError = String(error);
    }
    
    console.error('[Manager Redeem] Returning generic 500 error with details:', errorDetails);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      details: errorDetails
    }, { status: 500 });
  }
}
