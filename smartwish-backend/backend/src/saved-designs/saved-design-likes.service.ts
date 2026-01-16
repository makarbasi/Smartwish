import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SavedDesignLikesService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      console.warn('SUPABASE_URL not found - SavedDesignLikes service unavailable');
      return;
    }

    if (!serviceRoleKey && !anonKey) {
      console.warn(
        'Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY found - SavedDesignLikes service unavailable',
      );
      return;
    }

    // Prefer service role key for better permissions
    const supabaseKey = serviceRoleKey || anonKey;
    if (!supabaseKey) {
      console.warn('No Supabase key found - SavedDesignLikes service unavailable');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ SavedDesignLikes service initialized with Supabase');
  }

  /**
   * Like a saved design
   */
  async likeDesign(designId: string, userId: string): Promise<{ success: boolean; likes: number }> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Check if design exists
      const { data: design, error: designError } = await this.supabase
        .from('saved_designs')
        .select('id, popularity')
        .eq('id', designId)
        .single();

      if (designError || !design) {
        throw new NotFoundException('Design not found');
      }

      // Check if already liked
      const { data: existingLike, error: likeCheckError } = await this.supabase
        .from('saved_design_likes')
        .select('id')
        .eq('design_id', designId)
        .eq('user_id', userId)
        .single();

      if (existingLike) {
        throw new ConflictException('Design already liked');
      }

      // Create like record
      const { error: insertError } = await this.supabase
        .from('saved_design_likes')
        .insert({
          design_id: designId,
          user_id: userId,
        });

      if (insertError) {
        throw insertError;
      }

      // Increment popularity
      const newPopularity = (design.popularity || 0) + 1;
      await this.supabase
        .from('saved_designs')
        .update({ popularity: newPopularity })
        .eq('id', designId);

      // Get updated likes count
      const { count, error: countError } = await this.supabase
        .from('saved_design_likes')
        .select('*', { count: 'exact', head: true })
        .eq('design_id', designId);

      return { success: true, likes: count || 0 };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unlike a saved design
   */
  async unlikeDesign(designId: string, userId: string): Promise<{ success: boolean; likes: number }> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Check if design exists
      const { data: design, error: designError } = await this.supabase
        .from('saved_designs')
        .select('id, popularity')
        .eq('id', designId)
        .single();

      if (designError || !design) {
        throw new NotFoundException('Design not found');
      }

      // Check if like exists
      const { data: existingLike, error: likeCheckError } = await this.supabase
        .from('saved_design_likes')
        .select('id')
        .eq('design_id', designId)
        .eq('user_id', userId)
        .single();

      if (!existingLike) {
        throw new NotFoundException('Like not found');
      }

      // Remove like record
      const { error: deleteError } = await this.supabase
        .from('saved_design_likes')
        .delete()
        .eq('design_id', designId)
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      // Decrement popularity (but don't go below 0)
      const newPopularity = Math.max(0, (design.popularity || 0) - 1);
      await this.supabase
        .from('saved_designs')
        .update({ popularity: newPopularity })
        .eq('id', designId);

      // Get updated likes count
      const { count, error: countError } = await this.supabase
        .from('saved_design_likes')
        .select('*', { count: 'exact', head: true })
        .eq('design_id', designId);

      return { success: true, likes: count || 0 };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user has liked a design
   */
  async hasUserLiked(designId: string, userId: string): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    const { data, error } = await this.supabase
      .from('saved_design_likes')
      .select('id')
      .eq('design_id', designId)
      .eq('user_id', userId)
      .single();

    return !!data;
  }

  /**
   * Get likes count for a design
   */
  async getLikesCount(designId: string): Promise<number> {
    if (!this.supabase) {
      return 0;
    }

    const { count, error } = await this.supabase
      .from('saved_design_likes')
      .select('*', { count: 'exact', head: true })
      .eq('design_id', designId);

    return count || 0;
  }

  /**
   * Get user's liked designs
   */
  async getUserLikedDesigns(userId: string): Promise<string[]> {
    if (!this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('saved_design_likes')
      .select('design_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(like => like.design_id);
  }

  /**
   * Get likes status for multiple designs for a user
   */
  async getMultipleLikesStatus(
    designIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    if (designIds.length === 0 || !this.supabase) {
      return {};
    }

    const { data, error } = await this.supabase
      .from('saved_design_likes')
      .select('design_id')
      .eq('user_id', userId);

    if (error || !data) {
      return {};
    }

    const likedDesignIds = new Set(data.map(like => like.design_id));
    const result: Record<string, boolean> = {};
    
    designIds.forEach(id => {
      result[id] = likedDesignIds.has(id);
    });

    return result;
  }
}

