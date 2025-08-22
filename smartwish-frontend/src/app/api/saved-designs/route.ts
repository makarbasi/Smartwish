import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/saved-designs - Get all saved designs for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;

    console.log('Saved designs API - User ID:', session.user.id);
    console.log('Saved designs API - Access Token exists:', !!accessToken);
    console.log('Saved designs API - API_BASE_URL:', API_BASE_URL);

    // First try a simple health check
    console.log('Testing backend connectivity...');
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Health check response:', healthResponse.status);
    } catch (healthError) {
      console.error('Health check failed:', healthError);
    }

    // Now try the actual request
    console.log('Making saved-designs request...');
    const response = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    console.log('Saved designs API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Saved designs API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const savedDesigns = await response.json();
    console.log('Saved designs API - Found designs:', savedDesigns.length);
    
    return NextResponse.json({
      success: true,
      data: savedDesigns,
    });

  } catch (error) {
    console.error('Error fetching saved designs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved designs' },
      { status: 500 }
    );
  }
}

// Helper function to convert blob URL to base64
async function blobUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to extract image URLs that need uploading
function extractImageUrls(body: any): string[] {
  const imageUrls: string[] = [];
  
  // From imageUrls array
  if (body.imageUrls && Array.isArray(body.imageUrls)) {
    imageUrls.push(...body.imageUrls);
  }
  
  // From designData.pages
  if (body.designData?.pages && Array.isArray(body.designData.pages)) {
    for (const page of body.designData.pages) {
      if (page.image) {
        imageUrls.push(page.image);
      }
    }
  }
  
  // From designData.editedPages
  if (body.designData?.editedPages) {
    for (const key in body.designData.editedPages) {
      if (body.designData.editedPages[key]) {
        imageUrls.push(body.designData.editedPages[key]);
      }
    }
  }
  
  // From individual image fields
  ['image_1', 'image_2', 'image_3', 'image_4'].forEach(field => {
    if (body[field]) {
      imageUrls.push(body[field]);
    }
  });
  
  return [...new Set(imageUrls)]; // Remove duplicates
}

// Helper function to replace image URLs in the body
function replaceImageUrls(body: any, urlMapping: Record<string, string>): any {
  const updatedBody = { ...body };
  
  // Replace in imageUrls array
  if (updatedBody.imageUrls && Array.isArray(updatedBody.imageUrls)) {
    updatedBody.imageUrls = updatedBody.imageUrls.map(url => urlMapping[url] || url);
  }
  
  // Replace in designData.pages
  if (updatedBody.designData?.pages && Array.isArray(updatedBody.designData.pages)) {
    updatedBody.designData.pages = updatedBody.designData.pages.map(page => ({
      ...page,
      image: urlMapping[page.image] || page.image
    }));
  }
  
  // Replace in designData.editedPages
  if (updatedBody.designData?.editedPages) {
    const editedPages = { ...updatedBody.designData.editedPages };
    for (const key in editedPages) {
      if (editedPages[key] && urlMapping[editedPages[key]]) {
        editedPages[key] = urlMapping[editedPages[key]];
      }
    }
    updatedBody.designData.editedPages = editedPages;
  }
  
  // Replace individual image fields
  ['image_1', 'image_2', 'image_3', 'image_4'].forEach(field => {
    if (updatedBody[field] && urlMapping[updatedBody[field]]) {
      updatedBody[field] = urlMapping[updatedBody[field]];
    }
  });
  
  return updatedBody;
}

// POST /api/saved-designs - Create a new saved design
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    const body = await request.json();

    console.log('Create saved design API - User ID:', session.user.id);

    // Check for blob URLs - these should be uploaded on frontend before reaching API
    const imageUrls = extractImageUrls(body);
    const blobUrls = imageUrls.filter(url => url && url.startsWith('blob:'));
    
    if (blobUrls.length > 0) {
      console.error('Create saved design API - Blob URLs found, these should be uploaded on frontend first:', blobUrls);
      return NextResponse.json(
        { error: 'Blob URLs detected. Please upload images before saving.', blobUrls },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(body),
    });

    console.log('Create saved design API - Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create saved design API - Error:', errorText);
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const newDesign = await response.json();
    console.log('Create saved design API - Created successfully');
    
    return NextResponse.json({
      success: true,
      data: newDesign,
    });

  } catch (error) {
    console.error('Error creating saved design:', error);
    return NextResponse.json(
      { error: 'Failed to create saved design' },
      { status: 500 }
    );
  }
}