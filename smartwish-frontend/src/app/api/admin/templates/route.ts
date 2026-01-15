import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/templates
 * List templates (greeting cards) or stickers with optional filters
 * Query params:
 *   - type: 'card' | 'sticker' (default: 'card')
 *   - category: category ID (for cards) or category name (for stickers)
 *   - search: search term for title/description
 *   - status: 'active' | 'inactive' (stickers only)
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'card';
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    if (type === 'sticker') {
      // Fetch stickers
      let query = supabase
        .from('stickers')
        .select('*', { count: 'exact' });

      // Apply category filter
      if (category) {
        query = query.eq('category', category);
      }

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply search filter
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: stickers, error, count } = await query;

      if (error) {
        console.error('[Admin Templates] Error fetching stickers:', error);
        return NextResponse.json(
          { error: 'Failed to fetch stickers' },
          { status: 500 }
        );
      }

      // Transform to include has_embedding flag
      const transformedStickers = (stickers || []).map((sticker: any) => ({
        ...sticker,
        has_embedding: sticker.embedding !== null && sticker.embedding !== undefined,
      }));

      return NextResponse.json({
        data: transformedStickers,
        count: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      });
    } else {
      // Fetch greeting cards (sw_templates) with category join
      let query = supabase
        .from('sw_templates')
        .select(`
          *,
          sw_categories!inner(id, name)
        `, { count: 'exact' });

      // Apply category filter
      if (category) {
        query = query.eq('category_id', category);
      }

      // Apply search filter
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: templates, error, count } = await query;

      if (error) {
        console.error('[Admin Templates] Error fetching templates:', error);
        return NextResponse.json(
          { error: 'Failed to fetch templates' },
          { status: 500 }
        );
      }

      // Transform to flatten category and include has_embedding flag
      const transformedTemplates = (templates || []).map((template: any) => ({
        ...template,
        category_name: template.sw_categories?.name || 'Unknown',
        has_embedding: template.embedding_vector !== null && template.embedding_vector !== undefined,
        sw_categories: undefined, // Remove nested object
      }));

      return NextResponse.json({
        data: transformedTemplates,
        count: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      });
    }
  } catch (error) {
    console.error('[Admin Templates] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/templates
 * Create a new template (greeting card) or sticker
 * Body:
 *   - type: 'card' | 'sticker'
 *   - ...template/sticker fields
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, ...data } = body;

    if (!type || !['card', 'sticker'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "card" or "sticker".' },
        { status: 400 }
      );
    }

    if (type === 'sticker') {
      // Validate required fields
      if (!data.title || !data.image_url) {
        return NextResponse.json(
          { error: 'Title and image_url are required for stickers' },
          { status: 400 }
        );
      }

      // Generate slug if not provided
      const slug = data.slug || generateSlug(data.title);

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('stickers')
        .select('id')
        .eq('slug', slug)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A sticker with this slug already exists' },
          { status: 400 }
        );
      }

      const stickerData = {
        title: data.title,
        slug,
        category: data.category || 'general',
        description: data.description || null,
        image_url: data.image_url,
        tags: data.tags || [],
        search_keywords: data.search_keywords || [],
        popularity: 0,
        num_downloads: 0,
        status: data.status || 'active',
      };

      const { data: newSticker, error } = await supabase
        .from('stickers')
        .insert(stickerData)
        .select()
        .single();

      if (error) {
        console.error('[Admin Templates] Error creating sticker:', error);
        return NextResponse.json(
          { error: 'Failed to create sticker' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...newSticker,
          has_embedding: false,
        },
      });
    } else {
      // Create greeting card (sw_templates)
      if (!data.title || !data.category_id || !data.cover_image) {
        return NextResponse.json(
          { error: 'Title, category_id, and cover_image are required for cards' },
          { status: 400 }
        );
      }

      // Generate slug if not provided
      const slug = data.slug || generateSlug(data.title);

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('sw_templates')
        .select('id')
        .eq('slug', slug)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A template with this slug already exists' },
          { status: 400 }
        );
      }

      const templateData = {
        title: data.title,
        slug,
        category_id: data.category_id,
        author_id: data.author_id || null,
        description: data.description || null,
        price: data.price || 2.99,
        cover_image: data.cover_image,
        target_audience: data.target_audience || null,
        occasion_type: data.occasion_type || null,
        style_type: data.style_type || null,
        image_1: data.image_1 || data.cover_image,
        image_2: data.image_2 || null,
        image_3: data.image_3 || null,
        image_4: data.image_4 || null,
        message: data.message || null,
        search_keywords: data.search_keywords || [],
      };

      const { data: newTemplate, error } = await supabase
        .from('sw_templates')
        .insert(templateData)
        .select(`
          *,
          sw_categories!inner(id, name)
        `)
        .single();

      if (error) {
        console.error('[Admin Templates] Error creating template:', error);
        return NextResponse.json(
          { error: 'Failed to create template' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...newTemplate,
          category_name: newTemplate.sw_categories?.name || 'Unknown',
          has_embedding: false,
          sw_categories: undefined,
        },
      });
    }
  } catch (error) {
    console.error('[Admin Templates] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate a URL-friendly slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}
