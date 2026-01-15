import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/admin/templates/categories
 * Get all categories for greeting cards (from sw_categories) 
 * and distinct categories for stickers (from stickers table)
 * Query params:
 *   - type: 'card' | 'sticker' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const result: {
      cardCategories?: Array<{ id: string; name: string }>;
      stickerCategories?: string[];
    } = {};

    // Fetch card categories from sw_categories table
    if (type === 'all' || type === 'card') {
      const { data: categories, error } = await supabase
        .from('sw_categories')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('[Admin Templates] Error fetching card categories:', error);
        return NextResponse.json(
          { error: 'Failed to fetch card categories' },
          { status: 500 }
        );
      }

      result.cardCategories = categories || [];
    }

    // Fetch distinct sticker categories
    if (type === 'all' || type === 'sticker') {
      const { data: stickers, error } = await supabase
        .from('stickers')
        .select('category')
        .not('category', 'is', null);

      if (error) {
        console.error('[Admin Templates] Error fetching sticker categories:', error);
        return NextResponse.json(
          { error: 'Failed to fetch sticker categories' },
          { status: 500 }
        );
      }

      // Extract unique categories
      const uniqueCategories = [...new Set((stickers || []).map((s: any) => s.category))];
      result.stickerCategories = uniqueCategories.sort();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Templates] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
