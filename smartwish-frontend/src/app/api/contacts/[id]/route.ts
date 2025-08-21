import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/contacts/[id] - Get a specific contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    const response = await fetch(
      `${API_BASE_URL}/contacts/${params.id}?userId=${session.user.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || ''}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const contact = await response.json();
    
    return NextResponse.json({
      success: true,
      data: contact,
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

// PUT /api/contacts/[id] - Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/contacts/${params.id}`, {
      method: 'PUT',
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
      if (response.status === 404) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const updatedContact = await response.json();
    
    return NextResponse.json({
      success: true,
      data: updatedContact,
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id] - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    const response = await fetch(
      `${API_BASE_URL}/contacts/${params.id}?userId=${session.user.id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || ''}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}