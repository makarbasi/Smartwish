import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// POST /api/templates/[id]/copy - Copy a template to user's saved designs
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session.user as any).access_token;
    
    console.log('Copy API - Template ID:', params.id);
    console.log('Copy API - API Base URL:', API_BASE_URL);
    console.log('Copy API - Access Token exists:', !!accessToken);

    // First, get the template data
    const templateUrl = `${API_BASE_URL}/templates-enhanced/templates/${params.id}`;
    console.log('Copy API - Fetching template from:', templateUrl);
    
    const templateResponse = await fetch(templateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Copy API - Template response status:', templateResponse.status);
    
    if (!templateResponse.ok) {
      const errorText = await templateResponse.text();
      console.error('Copy API - Template fetch error:', errorText);
      
      if (templateResponse.status === 404) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw new Error(`Failed to fetch template: ${templateResponse.status} - ${errorText}`);
    }

    const templateResult = await templateResponse.json();
    
    // Handle backend response structure
    if (!templateResult.success || !templateResult.data) {
      return NextResponse.json({ error: templateResult.error || 'Template not found' }, { status: 404 });
    }
    
    const template = templateResult.data;

    // Get user's existing designs to check for duplicate names
    const designsResponse = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
    });

    let existingDesigns = [];
    if (designsResponse.ok) {
      existingDesigns = await designsResponse.json();
    }

    // Generate unique name
    const baseName = template.title || 'Template';
    let copyName = `${baseName} - Copy`;
    let counter = 1;
    
    while (existingDesigns.some((design: any) => design.title === copyName)) {
      counter++;
      copyName = `${baseName} - Copy ${counter}`;
    }

    console.log('Template data structure:', template);

    // Create design data structure for saved designs
    const designData = {
      title: copyName,
      description: template.description || `Copy of ${baseName}`,
      category: template.category?.name || 'General',
      designData: {
        templateKey: template.slug || template.id,
        // Create pages from template images - using the correct field names
        pages: [
          template.image_1 || template.image1,
          template.image_2 || template.image2,
          template.image_3 || template.image3,
          template.image_4 || template.image4
        ].filter(Boolean).map((image: string, index: number) => ({
          header: `Page ${index + 1}`,
          image: image,
          text: '',
          footer: ''
        })),
        editedPages: {},
        // Store original template data for reference
        originalTemplate: {
          id: template.id,
          title: template.title,
          slug: template.slug,
          coverImage: template.cover_image || template.coverImage || template.image_1 || template.image1
        }
      },
      thumbnail: template.cover_image || template.coverImage || template.image_1 || template.image1,
      // Copy additional metadata
      searchKeywords: template.tags || [],
      language: template.language || 'en',
      region: template.region || 'US'
    };

    // Save the design to user's saved designs
    const saveResponse = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify(designData),
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('Failed to save design:', errorText);
      throw new Error(`Failed to save design: ${saveResponse.status}`);
    }

    const savedDesign = await saveResponse.json();
    
    return NextResponse.json({
      success: true,
      data: savedDesign,
      message: `Template copied as "${copyName}"`,
    });

  } catch (error) {
    console.error('Error copying template:', error);
    return NextResponse.json(
      { error: 'Failed to copy template', details: error.message },
      { status: 500 }
    );
  }
}