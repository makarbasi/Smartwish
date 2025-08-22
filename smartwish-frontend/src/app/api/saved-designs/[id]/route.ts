import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/saved-designs/[id] - Get a specific saved design
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

    console.log('Get saved design API - Design ID:', params.id);
    console.log('Get saved design API - User ID:', session.user.id);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${params.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Get saved design API - Response status:', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      const errorText = await response.text();
      console.error('Get saved design API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const design = await response.json();
    console.log('Get saved design API - Found design');
    
    return NextResponse.json({
      success: true,
      data: design,
    });

  } catch (error) {
    console.error('Error fetching saved design:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved design' },
      { status: 500 }
    );
  }
}

// PUT /api/saved-designs/[id] - Update a saved design
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

    console.log('Update saved design API - Design ID:', params.id);
    console.log('Update saved design API - User ID:', session.user.id);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(body),
    });

    console.log('Update saved design API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Update saved design API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const updatedDesign = await response.json();
    console.log('Update saved design API - Updated successfully');
    
    return NextResponse.json({
      success: true,
      data: updatedDesign,
    });

  } catch (error) {
    console.error('Error updating saved design:', error);
    return NextResponse.json(
      { error: 'Failed to update saved design' },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-designs/[id] - Delete a saved design
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
    
    console.log('Delete API - Design ID:', params.id);
    console.log('Delete API - Access Token exists:', !!accessToken);

    const response = await fetch(`${API_BASE_URL}/saved-designs/${params.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Delete API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete API - Error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 });
      }
      throw new Error(`Failed to delete design: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: result.message || 'Design deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting design:', error);
    return NextResponse.json(
      { error: 'Failed to delete design', details: error.message },
      { status: 500 }
    );
  }
}