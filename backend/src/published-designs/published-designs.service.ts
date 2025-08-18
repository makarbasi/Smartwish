import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnhancedStorageService } from '../storage/enhanced-storage.service';

export interface PublishedDesign {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  authorId: string;
  originalDesignId?: string;
  templateData: any;
  pageCount: number;
  price: number;
  isFree: boolean;
  licenseType: string;
  language: string;
  region: string;
  slug: string;
  searchKeywords: string[];
  tags: string[];
  popularityScore: number;
  downloadCount: number;
  viewCount: number;
  likeCount: number;
  status: 'published' | 'featured' | 'archived' | 'removed';
  isFeatured: boolean;
  featuredAt?: Date;
  publishedAt: Date;
  lastUpdated: Date;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishedDesignWithDetails extends PublishedDesign {
  authorName: string;
  authorAvatar?: string;
  authorVerified: boolean;
  categoryName: string;
  categoryDisplayName: string;
  reviewCount: number;
  averageRating: number;
  images: Array<{
    pageNumber: number;
    imageType: string;
    publicUrl: string;
    webpUrl: string;
    thumbnailUrl: string;
    dimensions: { width: number; height: number };
  }>;
}

export interface CreatePublishedDesignDto {
  title: string;
  description: string;
  categoryId: string;
  userId: string;
  userEmail?: string;
  originalDesignId?: string;
  templateData: any;
  searchKeywords: string[];
  tags?: string[];
  language?: string;
  region?: string;
  images: string[]; // Base64 image data
}

@Injectable()
export class PublishedDesignsService {
  private supabase: SupabaseClient;

  constructor(private enhancedStorage: EnhancedStorageService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Published Designs service not configured - missing Supabase credentials');
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log('✅ Published Designs service initialized');
  }

  /**
   * Publish a design from saved_designs to published_designs
   */
  async publishDesign(dto: CreatePublishedDesignDto): Promise<PublishedDesign> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      console.log(`📤 Publishing design: ${dto.title}`);

      // 1. Ensure author exists (strict UUID identity, optional email backfill)
      const authorId = await this.ensureAuthorExists(dto.userId, dto.userEmail);

      // 2. Generate unique slug
      const slug = await this.generateUniqueSlug(dto.title);

      // 3. Create design record first (to get ID for storage)
      const designId = this.generateId();
      
      // Create database insert object with snake_case column names
      const dbInsertData = {
        id: designId,
        title: dto.title,
        description: dto.description,
        category_id: dto.categoryId,
        author_id: authorId,
        original_design_id: dto.originalDesignId,
        template_data: dto.templateData,
        page_count: dto.images.length,
        price: 0,
        is_free: true,
        license_type: 'free',
        language: dto.language || 'en',
        region: dto.region || 'US',
        slug,
        search_keywords: dto.searchKeywords,
        tags: dto.tags || [],
        popularity_score: 0,
        download_count: 0,
        view_count: 0,
        like_count: 0,
        status: 'published',
        is_featured: false,
        published_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 4. Insert design record
      const { data: insertedDesign, error: insertError } = await this.supabase
        .from('sw_published_designs')
        .insert([dbInsertData])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting published design:', insertError);
        throw new Error(`Failed to create published design: ${insertError.message}`);
      }

      // 5. Process and upload images using enhanced storage
      try {
        const publishResult = await this.enhancedStorage.publishDesign(
          designId,
          dto.userId,
          dto.images,
          dto.title
        );

        console.log(`✅ Images processed and uploaded for design ${designId}`);

        // 6. Update original design status if provided
        if (dto.originalDesignId) {
          await this.updateOriginalDesignStatus(dto.originalDesignId, designId);
        }

        // 7. Record analytics event
        await this.recordAnalyticsEvent(designId, 'publish', dto.userId);

        // Map database object back to PublishedDesign interface
        const publishedDesign: PublishedDesign = {
          id: designId,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          authorId: authorId,
          originalDesignId: dto.originalDesignId,
          templateData: dto.templateData,
          pageCount: dto.images.length,
          price: 0,
          isFree: true,
          licenseType: 'free',
          language: dto.language || 'en',
          region: dto.region || 'US',
          slug,
          searchKeywords: dto.searchKeywords,
          tags: dto.tags || [],
          popularityScore: 0,
          downloadCount: 0,
          viewCount: 0,
          likeCount: 0,
          status: 'published',
          isFeatured: false,
          publishedAt: new Date(),
          lastUpdated: new Date(),
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        return publishedDesign;

      } catch (storageError) {
        // Rollback: Delete the design record if image processing fails
        console.error('Image processing failed, rolling back design creation:', storageError);
        await this.supabase
          .from('sw_published_designs')
          .delete()
          .eq('id', designId);
        
        throw new Error(`Image processing failed: ${storageError.message}`);
      }

    } catch (error) {
      console.error('Error publishing design:', error);
      throw error;
    }
  }

  /**
   * Get all published designs with details
   */
  async getAllPublishedDesigns(options: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    authorId?: string;
    featured?: boolean;
    sortBy?: 'newest' | 'popular' | 'downloads' | 'rating';
  } = {}): Promise<PublishedDesignWithDetails[]> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      let query = this.supabase
        .from('vw_published_designs_with_author')
        .select('*')
        .eq('status', 'published');

      // Apply filters
      if (options.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options.authorId) {
        query = query.eq('author_id', options.authorId);
      }
      if (options.featured) {
        query = query.eq('is_featured', true);
      }

      // Apply sorting
      switch (options.sortBy) {
        case 'popular':
          query = query.order('popularity_score', { ascending: false });
          break;
        case 'downloads':
          query = query.order('download_count', { ascending: false });
          break;
        case 'rating':
          query = query.order('average_rating', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('published_at', { ascending: false });
          break;
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data: designs, error } = await query;

      if (error) {
        console.error('Error fetching published designs:', error);
        throw new Error(`Failed to fetch designs: ${error.message}`);
      }

      // Fetch images for each design
      const designsWithImages = await Promise.all(
        designs.map(async (design) => {
          const images = await this.getDesignImages(design.id);
          return {
            ...this.mapDbToDesign(design),
            authorName: design.author_name,
            authorAvatar: design.author_avatar,
            authorVerified: design.author_verified,
            categoryName: design.category_name,
            categoryDisplayName: design.category_display_name,
            reviewCount: design.review_count || 0,
            averageRating: design.average_rating || 0,
            images
          };
        })
      );

      return designsWithImages;

    } catch (error) {
      console.error('Error in getAllPublishedDesigns:', error);
      throw error;
    }
  }

  /**
   * Get published designs by user
   */
  async getUserPublishedDesigns(userId: string): Promise<PublishedDesignWithDetails[]> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      // Get author ID for user
      const { data: author, error: authorError } = await this.supabase
        .from('sw_authors')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (authorError || !author) {
        console.log(`No author found for user ${userId}`);
        return [];
      }

      return this.getAllPublishedDesigns({ authorId: author.id });

    } catch (error) {
      console.error('Error getting user published designs:', error);
      throw error;
    }
  }

  /**
   * Get single published design by ID
   */
  async getPublishedDesignById(designId: string): Promise<PublishedDesignWithDetails | null> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      const { data: design, error } = await this.supabase
        .from('vw_published_designs_with_author')
        .select('*')
        .eq('id', designId)
        .eq('status', 'published')
        .single();

      if (error || !design) {
        return null;
      }

      // Get images
      const images = await this.getDesignImages(designId);

      // Record view event
      await this.recordAnalyticsEvent(designId, 'view');

      return {
        ...this.mapDbToDesign(design),
        authorName: design.author_name,
        authorAvatar: design.author_avatar,
        authorVerified: design.author_verified,
        categoryName: design.category_name,
        categoryDisplayName: design.category_display_name,
        reviewCount: design.review_count || 0,
        averageRating: design.average_rating || 0,
        images
      };

    } catch (error) {
      console.error('Error getting published design:', error);
      throw error;
    }
  }

  /**
   * Unpublish a design (archive it)
   */
  async unpublishDesign(designId: string, userId: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      // Verify user owns the design
      const { data: design, error: fetchError } = await this.supabase
        .from('sw_published_designs')
        .select('id, author_id')
        .eq('id', designId)
        .single();

      if (fetchError || !design) {
        throw new Error('Design not found');
      }

      // Check if user owns the design
      const { data: author, error: authorError } = await this.supabase
        .from('sw_authors')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (authorError || !author || author.id !== design.author_id) {
        throw new Error('Unauthorized: You can only unpublish your own designs');
      }

      // Update design status
      const { error: updateError } = await this.supabase
        .from('sw_published_designs')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', designId);

      if (updateError) {
        console.error('Error unpublishing design:', updateError);
        throw new Error(`Failed to unpublish design: ${updateError.message}`);
      }

      // Record analytics event
      await this.recordAnalyticsEvent(designId, 'unpublish', userId);

      console.log(`✅ Design ${designId} unpublished by user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error in unpublishDesign:', error);
      throw error;
    }
  }

  /**
   * Record download for a design
   */
  async recordDownload(designId: string, userId?: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Published Designs service not configured');
    }

    try {
      // Increment download count
      const { error: updateError } = await this.supabase
        .rpc('increment_download_count', { design_id: designId });

      if (updateError) {
        console.error('Error updating download count:', updateError);
      }

      // Record analytics event
      await this.recordAnalyticsEvent(designId, 'download', userId);

      return true;

    } catch (error) {
      console.error('Error recording download:', error);
      return false;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Ensure author record exists for user
   */
  private async ensureAuthorExists(userId: string, userEmail?: string): Promise<string> {
    try {
      // First try find an author by linked user_id (UUID from JWT)
      const { data: existingByUser, error: existingByUserError } = await this.supabase
        .from('sw_authors')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingByUserError && existingByUser?.id) {
        return existingByUser.id;
      }

      // Try find author by email if provided (convenience backfill only)
      const { data: existingByEmail, error: existingByEmailError } = await this.supabase
        .from('sw_authors')
        .select('id')
        .eq('email', userEmail || '')
        .maybeSingle();

      if (!existingByEmailError && existingByEmail?.id) {
        // Backfill user_id for linkage
        await this.supabase
          .from('sw_authors')
          .update({ user_id: userId })
          .eq('id', existingByEmail.id);
        return existingByEmail.id;
      }

      // Create author record with UUID user_id and optional email
      const { data: newAuthor, error: createError } = await this.supabase
        .from('sw_authors')
        .insert([{
          user_id: userId,
          name: 'Anonymous',
          email: userEmail,
          bio: null,
          is_verified: false
        }])
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create author: ${createError.message}`);
      }

      return newAuthor.id;

    } catch (error) {
      console.error('Error ensuring author exists:', error);
      throw error;
    }
  }

  /**
   * Generate unique slug for design
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data, error } = await this.supabase
        .from('sw_published_designs')
        .select('id')
        .eq('slug', slug)
        .limit(1);

      if (error) {
        throw new Error(`Error checking slug uniqueness: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Generate UUID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Update original design status
   */
  private async updateOriginalDesignStatus(originalDesignId: string, publishedDesignId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('saved_designs')
        .update({ 
          status: 'published',
          updated_at: new Date().toISOString()
        })
        .eq('id', originalDesignId);

      if (error) {
        console.warn('Could not update original design status:', error);
      }

    } catch (error) {
      console.warn('Error updating original design status:', error);
    }
  }

  /**
   * Get design images
   */
  private async getDesignImages(designId: string): Promise<Array<{
    pageNumber: number;
    imageType: string;
    publicUrl: string;
    webpUrl: string;
    thumbnailUrl: string;
    dimensions: { width: number; height: number };
  }>> {
    try {
      const { data: images, error } = await this.supabase
        .from('sw_design_images')
        .select('*')
        .eq('design_id', designId)
        .order('page_number', { ascending: true });

      if (error) {
        console.error('Error fetching design images:', error);
        return [];
      }

      return images.map(img => ({
        pageNumber: img.page_number,
        imageType: img.image_type,
        publicUrl: img.public_url,
        webpUrl: img.webp_url || img.public_url,
        thumbnailUrl: img.thumbnail_url || img.public_url,
        dimensions: img.dimensions || { width: 800, height: 600 }
      }));

    } catch (error) {
      console.error('Error in getDesignImages:', error);
      return [];
    }
  }

  /**
   * Record analytics event
   */
  private async recordAnalyticsEvent(
    designId: string, 
    eventType: string, 
    userId?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('sw_design_analytics')
        .insert([{
          design_id: designId,
          event_type: eventType,
          user_id: userId || null,
          event_data: {}
        }]);

      if (error) {
        console.warn('Could not record analytics event:', error);
      }

    } catch (error) {
      console.warn('Error recording analytics event:', error);
    }
  }

  /**
   * Map database record to PublishedDesign interface
   */
  private mapDbToDesign(dbRecord: any): PublishedDesign {
    return {
      id: dbRecord.id,
      title: dbRecord.title,
      description: dbRecord.description,
      categoryId: dbRecord.category_id,
      authorId: dbRecord.author_id,
      originalDesignId: dbRecord.original_design_id,
      templateData: dbRecord.template_data,
      pageCount: dbRecord.page_count,
      price: dbRecord.price,
      isFree: dbRecord.is_free,
      licenseType: dbRecord.license_type,
      language: dbRecord.language,
      region: dbRecord.region,
      slug: dbRecord.slug,
      searchKeywords: dbRecord.search_keywords,
      tags: dbRecord.tags,
      popularityScore: dbRecord.popularity_score,
      downloadCount: dbRecord.download_count,
      viewCount: dbRecord.view_count,
      likeCount: dbRecord.like_count,
      status: dbRecord.status,
      isFeatured: dbRecord.is_featured,
      featuredAt: dbRecord.featured_at ? new Date(dbRecord.featured_at) : undefined,
      publishedAt: new Date(dbRecord.published_at),
      lastUpdated: new Date(dbRecord.last_updated),
      version: dbRecord.version,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    };
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Array<{ id: string; slug: string; name: string; displayName: string; description?: string; isActive: boolean }>> {
    try {
      const { data: categories, error } = await this.supabase
        .from('sw_categories')
        .select('id, slug, name, display_name, description, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      return categories.map(cat => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        displayName: cat.display_name,
        description: cat.description,
        isActive: cat.is_active
      }));

    } catch (error) {
      console.error('Error in getCategories:', error);
      return [];
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.supabase;
  }
}
