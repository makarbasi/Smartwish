import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/contacts - Get all contacts for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const search = searchParams.get('search') || '';

    // If search query is provided, use search endpoint
    let url = `${API_BASE_URL}/contacts`;
    if (search) {
      url = `${API_BASE_URL}/contacts/search/${encodeURIComponent(search)}`;
    }
    
    const response = await fetch(`${url}?userId=${session.user.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const contacts = await response.json();
    
    // Handle pagination on frontend since backend doesn't support it yet
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedContacts = contacts.slice(startIndex, endIndex);
    
    return NextResponse.json({
      success: true,
      data: paginatedContacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: contacts.length,
        totalPages: Math.ceil(contacts.length / limitNum),
      },
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify({
        ...body,
        userId: session.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const newContact = await response.json();
    
    return NextResponse.json({
      success: true,
      data: newContact,
    });

  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}