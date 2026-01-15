import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/templates/[id]
 * Get a single template or sticker by ID
 * Query params:
 *   - type: 'card' | 'sticker' (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'card';

    if (type === 'sticker') {
      const { data: sticker, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !sticker) {
        return NextResponse.json(
          { error: 'Sticker not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: {
          ...sticker,
          has_embedding: sticker.embedding !== null && sticker.embedding !== undefined,
        },
      });
    } else {
      const { data: template, error } = await supabase
        .from('sw_templates')
        .select(`
          *,
          sw_categories!inner(id, name)
        `)
        .eq('id', id)
        .single();

      if (error || !template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: {
          ...template,
          category_name: template.sw_categories?.name || 'Unknown',
          has_embedding: template.embedding_vector !== null && template.embedding_vector !== undefined,
          sw_categories: undefined,
        },
      });
    }
  } catch (error) {
    console.error('[Admin Templates] Error fetching:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/templates/[id]
 * Update a template or sticker
 * Body:
 *   - type: 'card' | 'sticker' (required)
 *   - ...fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type, ...updates } = body;

    if (!type || !['card', 'sticker'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "card" or "sticker".' },
        { status: 400 }
      );
    }

    if (type === 'sticker') {
      // Check if sticker exists
      const { data: existing, error: findError } = await supabase
        .from('stickers')
        .select('id')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { error: 'Sticker not found' },
          { status: 404 }
        );
      }

      // Check slug uniqueness if updating slug
      if (updates.slug) {
        const { data: slugCheck } = await supabase
          .from('stickers')
          .select('id')
          .eq('slug', updates.slug)
          .neq('id', id)
          .single();

        if (slugCheck) {
          return NextResponse.json(
            { error: 'A sticker with this slug already exists' },
            { status: 400 }
          );
        }
      }

      // Build update object with only allowed fields
      const allowedFields = [
        'title', 'slug', 'category', 'description', 'image_url',
        'tags', 'search_keywords', 'status'
      ];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      updateData.updated_at = new Date().toISOString();

      const { data: updatedSticker, error } = await supabase
        .from('stickers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[Admin Templates] Error updating sticker:', error);
        return NextResponse.json(
          { error: 'Failed to update sticker' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...updatedSticker,
          has_embedding: updatedSticker.embedding !== null && updatedSticker.embedding !== undefined,
        },
      });
    } else {
      // Update greeting card (sw_templates)
      const { data: existing, error: findError } = await supabase
        .from('sw_templates')
        .select('id')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      // Check slug uniqueness if updating slug
      if (updates.slug) {
        const { data: slugCheck } = await supabase
          .from('sw_templates')
          .select('id')
          .eq('slug', updates.slug)
          .neq('id', id)
          .single();

        if (slugCheck) {
          return NextResponse.json(
            { error: 'A template with this slug already exists' },
            { status: 400 }
          );
        }
      }

      // Build update object with only allowed fields
      const allowedFields = [
        'title', 'slug', 'category_id', 'author_id', 'description', 'price',
        'cover_image', 'target_audience', 'occasion_type', 'style_type',
        'image_1', 'image_2', 'image_3', 'image_4', 'message', 'search_keywords'
      ];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      updateData.updated_at = new Date().toISOString();

      const { data: updatedTemplate, error } = await supabase
        .from('sw_templates')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          sw_categories!inner(id, name)
        `)
        .single();

      if (error) {
        console.error('[Admin Templates] Error updating template:', error);
        return NextResponse.json(
          { error: 'Failed to update template' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...updatedTemplate,
          category_name: updatedTemplate.sw_categories?.name || 'Unknown',
          has_embedding: updatedTemplate.embedding_vector !== null && updatedTemplate.embedding_vector !== undefined,
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
 * DELETE /api/admin/templates/[id]
 * Delete a template or sticker
 * For stickers: soft-delete by setting status to 'inactive'
 * For cards: hard delete
 * Query params:
 *   - type: 'card' | 'sticker' (required)
 *   - hard: 'true' to permanently delete stickers (optional)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'card';
    const hardDelete = searchParams.get('hard') === 'true';

    if (type === 'sticker') {
      // Check if sticker exists
      const { data: existing, error: findError } = await supabase
        .from('stickers')
        .select('id, title')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { error: 'Sticker not found' },
          { status: 404 }
        );
      }

      if (hardDelete) {
        // Permanently delete
        const { error } = await supabase
          .from('stickers')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[Admin Templates] Error deleting sticker:', error);
          return NextResponse.json(
            { error: 'Failed to delete sticker' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Sticker "${existing.title}" permanently deleted`,
        });
      } else {
        // Soft delete - set status to inactive
        const { error } = await supabase
          .from('stickers')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          console.error('[Admin Templates] Error deactivating sticker:', error);
          return NextResponse.json(
            { error: 'Failed to deactivate sticker' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Sticker "${existing.title}" deactivated`,
        });
      }
    } else {
      // Delete greeting card (hard delete)
      const { data: existing, error: findError } = await supabase
        .from('sw_templates')
        .select('id, title')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      const { error } = await supabase
        .from('sw_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Admin Templates] Error deleting template:', error);
        return NextResponse.json(
          { error: 'Failed to delete template' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Template "${existing.title}" deleted`,
      });
    }
  } catch (error) {
    console.error('[Admin Templates] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
