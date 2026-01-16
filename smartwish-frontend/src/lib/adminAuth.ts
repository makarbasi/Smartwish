import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Admin email - only this account can access /admin API routes
// Set ADMIN_EMAIL in your .env.local file (server-side, not NEXT_PUBLIC_)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@smartwish.us";

export interface AdminAuthResult {
  authorized: boolean;
  session: any;
  error?: NextResponse;
}

/**
 * Verify that the current user is authenticated AND is the admin.
 * Use this in all /api/admin/* routes.
 * 
 * @returns AdminAuthResult with authorized status and session or error response
 * 
 * @example
 * export async function GET() {
 *   const { authorized, session, error } = await verifyAdmin();
 *   if (!authorized) return error;
 *   
 *   // Continue with admin-only logic...
 * }
 */
export async function verifyAdmin(): Promise<AdminAuthResult> {
  try {
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.access_token) {
      return {
        authorized: false,
        session: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    
    // Check if user is the admin
    const userEmail = session.user.email?.toLowerCase();
    const adminEmail = ADMIN_EMAIL.toLowerCase();
    
    if (userEmail !== adminEmail) {
      console.warn(`[Admin API] Access denied for user: ${session.user.email}`);
      return {
        authorized: false,
        session,
        error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
      };
    }
    
    return {
      authorized: true,
      session,
    };
  } catch (error) {
    console.error('[Admin API] Auth error:', error);
    return {
      authorized: false,
      session: null,
      error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    };
  }
}

/**
 * Check if an email is the admin email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
