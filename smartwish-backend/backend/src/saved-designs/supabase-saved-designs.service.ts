import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

export interface SavedDesign {
  id: string;
  userId: string;
  title: string;
  description: string;
  designData: {
    templateKey: string;
    pages: Array<{
      header: string;
      image: string;
      text: string;
      footer: string;
    }>;
    editedPages: Record<number, string>;
  };
  thumbnail?: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  // Image fields for generated card images
  imageUrls?: string[];
  imageTimestamp?: number;
  // Additional metadata fields for consistency with Template
  author?: string;
  upload_time?: string;
  price?: number;
  language?: string;
  region?: string;
  popularity?: number;
  num_downloads?: number;
  searchKeywords?: string[];
  // Status field for future use
  status?:
    | 'draft'
    | 'published'
    | 'archived'
    | 'template_candidate'
    | 'published_to_templates';
  // New fields for sw_templates compatibility
  templateId?: string;
  slug?: string;
  categoryId?: string;
  authorId?: string;
  createdByUserId?: string;
  coverImage?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  isFeatured?: boolean;
  isUserGenerated?: boolean;
  tags?: string[];
  currentVersion?: string;
  publishedAt?: Date;
  sourceTemplateId?: string;
}

@Injectable()
export class SupabaseSavedDesignsService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      console.warn('SUPABASE_URL not found - Supabase service unavailable');
      return;
    }

    if (!serviceRoleKey && !anonKey) {
      console.warn(
        'Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY found - Supabase service unavailable',
      );
      return;
    }

    // Prefer service role key for better permissions
    const supabaseKey = serviceRoleKey || anonKey;
    if (!supabaseKey) {
      console.warn('No Supabase key found - Supabase service unavailable');
      return;
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);

    if (serviceRoleKey) {
      console.log(
        '✅ Supabase connected with service role key (full permissions)',
      );
    } else {
      console.log('⚠️ Supabase connected with anon key (limited permissions)');
    }
  }

  isAvailable(): boolean {
    return !!this.supabase;
  }

  private getUuidForUserId(userId: string): string {
    // Deterministic UUID derived from userId to ensure stability across restarts
    return uuidv5(String(userId), uuidv5.DNS);
  }

  async saveDesign(
    userId: string,
    designData: Omit<SavedDesign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<SavedDesign> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Extract page images from designData or use direct image fields
    let page1Image = null,
      page2Image = null,
      page3Image = null,
      page4Image = null;

    if (designData.designData?.pages) {
      page1Image = designData.designData.pages[0]?.image || null;
      page2Image = designData.designData.pages[1]?.image || null;
      page3Image = designData.designData.pages[2]?.image || null;
      page4Image = designData.designData.pages[3]?.image || null;
    }

    // Use direct image fields if provided (override page images)
    page1Image = designData.image1 || page1Image;
    page2Image = designData.image2 || page2Image;
    page3Image = designData.image3 || page3Image;
    page4Image = designData.image4 || page4Image;

    const { data, error } = await this.supabase
      .from('saved_designs')
      .insert({
        author_id: userId, // Maps to user ID who created the design
        title: designData.title,
        description: designData.description,
        category_id: designData.categoryId, // Use categoryId if provided
        price: designData.price || 0,
        language: designData.language || 'en',
        region: designData.region || 'US',
        status: designData.status || 'draft',
        popularity: designData.popularity || 0,
        num_downloads: designData.num_downloads || 0,
        cover_image: designData.thumbnail || page1Image, // Use first page as cover if no thumbnail
        // Store individual page images
        image_1: page1Image,
        image_2: page2Image,
        image_3: page3Image,
        image_4: page4Image,
        search_keywords: designData.searchKeywords || [],
        tags: designData.tags || [],
        // Keep minimal metadata for backward compatibility
        metadata: {
          designData: designData.designData,
          imageUrls: designData.imageUrls || [],
          imageTimestamp: designData.imageTimestamp,
          author: designData.author || 'User',
          templateId: designData.templateId,
          slug: designData.slug,
          authorId: designData.authorId,
          createdByUserId: designData.createdByUserId || userId,
          coverImage: designData.coverImage,
          isFeatured: designData.isFeatured,
          isUserGenerated: designData.isUserGenerated,
          currentVersion: designData.currentVersion,
          sourceTemplateId: designData.sourceTemplateId,
        },
        // Set timestamps if this is from a template copy
        submitted_at: designData.publishedAt ? new Date().toISOString() : null,
        reviewed_at: null,
        reviewed_by_user_id: null,
        review_notes: null,
        is_user_generated: designData.isUserGenerated || true,
        original_saved_design_id: designData.sourceTemplateId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving design to Supabase:', error);
      throw new Error('Failed to save design');
    }

    return this.mapDatabaseRecordToSavedDesign(data);
  }

  async getUserDesigns(userId: string): Promise<SavedDesign[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('author_id', userId)
      .in('status', ['draft', null]) // Only get draft designs (null for backward compatibility)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user designs from Supabase:', error);
      throw new Error('Failed to fetch designs');
    }

    return data.map((record) => this.mapDatabaseRecordToSavedDesign(record));
  }

  async getDesignById(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .eq('author_id', userId)
      .single();

    if (error) {
      console.error('Error fetching design from Supabase:', error);
      return null;
    }

    return this.mapDatabaseRecordToSavedDesign(data);
  }

  async getPublicDesignById(designId: string): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .single();

    if (error) {
      console.error('Error fetching public design from Supabase:', error);
      return null;
    }

    return this.mapDatabaseRecordToSavedDesign(data);
  }

  async updateDesign(
    userId: string,
    designId: string,
    updates: Partial<SavedDesign>,
  ): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log('🔄 SupabaseService updateDesign - Design ID:', designId);
    console.log(
      '🔄 SupabaseService updateDesign - Updates:',
      JSON.stringify(updates, null, 2),
    );
    console.log(
      '🔄 SupabaseService updateDesign - CategoryId:',
      updates.categoryId,
    );

    // First, get the current record to preserve existing metadata
    const { data: currentRecord, error: fetchError } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .eq('author_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching current design:', fetchError);
      return null;
    }

    const currentMetadata = currentRecord.metadata || {};

    // Build update data for the new schema
    const updateData: any = {};

    // Direct field updates
    if (updates.title) updateData.title = updates.title;
    if (updates.description) updateData.description = updates.description;
    if (updates.categoryId) {
      updateData.category_id = updates.categoryId;
      console.log(
        '🎯 SupabaseService - Setting category_id in updateData:',
        updates.categoryId,
      );
    }
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.language) updateData.language = updates.language;
    if (updates.region) updateData.region = updates.region;
    if (updates.popularity !== undefined)
      updateData.popularity = updates.popularity;
    if (updates.num_downloads !== undefined)
      updateData.num_downloads = updates.num_downloads;
    if (updates.searchKeywords)
      updateData.search_keywords = updates.searchKeywords;
    if (updates.status) updateData.status = updates.status;
    if (updates.thumbnail) updateData.cover_image = updates.thumbnail;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.slug) updateData.slug = updates.slug;
    if (updates.isUserGenerated !== undefined)
      updateData.is_user_generated = updates.isUserGenerated;
    if (updates.publishedAt !== undefined) {
      updateData.published_at = updates.publishedAt
        ? updates.publishedAt.toISOString()
        : null;
    }
    if (updates.updatedAt)
      updateData.updated_at = updates.updatedAt.toISOString();
    if (updates.sourceTemplateId)
      updateData.original_saved_design_id = updates.sourceTemplateId;

    // Extract and update individual page images from designData or direct image fields
    if (updates.designData?.pages) {
      if (updates.designData.pages[0]?.image)
        updateData.image_1 = updates.designData.pages[0].image;
      if (updates.designData.pages[1]?.image)
        updateData.image_2 = updates.designData.pages[1].image;
      if (updates.designData.pages[2]?.image)
        updateData.image_3 = updates.designData.pages[2].image;
      if (updates.designData.pages[3]?.image)
        updateData.image_4 = updates.designData.pages[3].image;
    }

    // Direct image field updates (override page images if provided)
    if (updates.image1) updateData.image_1 = updates.image1;
    if (updates.image2) updateData.image_2 = updates.image2;
    if (updates.image3) updateData.image_3 = updates.image3;
    if (updates.image4) updateData.image_4 = updates.image4;

    // Update metadata with new values
    const newMetadata = {
      ...currentMetadata,
    };

    if (updates.designData) newMetadata.designData = updates.designData;
    if (updates.imageUrls) newMetadata.imageUrls = updates.imageUrls;
    if (updates.imageTimestamp)
      newMetadata.imageTimestamp = updates.imageTimestamp;
    if (updates.author) newMetadata.author = updates.author;
    if (updates.templateId) newMetadata.templateId = updates.templateId;
    if (updates.authorId) newMetadata.authorId = updates.authorId;
    if (updates.createdByUserId)
      newMetadata.createdByUserId = updates.createdByUserId;
    if (updates.coverImage) newMetadata.coverImage = updates.coverImage;
    if (updates.image1) newMetadata.image1 = updates.image1;
    if (updates.image2) newMetadata.image2 = updates.image2;
    if (updates.image3) newMetadata.image3 = updates.image3;
    if (updates.image4) newMetadata.image4 = updates.image4;
    if (updates.isFeatured !== undefined)
      newMetadata.isFeatured = updates.isFeatured;
    if (updates.currentVersion)
      newMetadata.currentVersion = updates.currentVersion;

    // Only update metadata if we have changes
    if (
      Object.keys(newMetadata).length > Object.keys(currentMetadata).length ||
      JSON.stringify(newMetadata) !== JSON.stringify(currentMetadata)
    ) {
      updateData.metadata = newMetadata;
    }

    console.log(
      '🎯 SupabaseService - Final updateData before database update:',
      JSON.stringify(updateData, null, 2),
    );

    const { data, error } = await this.supabase
      .from('saved_designs')
      .update(updateData)
      .eq('id', designId)
      .eq('author_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating design in Supabase:', error);
      return null;
    }

    console.log(
      '✅ SupabaseService - Database update successful, returning mapped design',
    );
    const result = this.mapDatabaseRecordToSavedDesign(data);
    console.log(
      '✅ SupabaseService - Final result categoryId:',
      result.categoryId,
    );
    return result;
  }

  async deleteDesign(userId: string, designId: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await this.supabase
      .from('saved_designs')
      .delete()
      .eq('id', designId)
      .eq('author_id', userId);

    if (error) {
      console.error('Error deleting design from Supabase:', error);
      return false;
    }

    return true;
  }

  async duplicateDesign(
    userId: string,
    designId: string,
    title?: string,
  ): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // First, get the original design
    const originalDesign = await this.getDesignById(userId, designId);
    if (!originalDesign) {
      return null;
    }

    // Generate a unique title
    let duplicateTitle = title;
    if (!duplicateTitle) {
      const existingDesigns = await this.getUserDesigns(userId);
      const baseName = originalDesign.title || 'Design';
      duplicateTitle = `${baseName} - Copy`;
      let counter = 1;

      while (
        existingDesigns.some((design) => design.title === duplicateTitle)
      ) {
        counter++;
        duplicateTitle = `${baseName} - Copy ${counter}`;
      }
    }

    // Create the duplicate
    const { data, error } = await this.supabase
      .from('saved_designs')
      .insert({
        user_id: userId,
        title: duplicateTitle,
        description:
          originalDesign.description || `Copy of ${originalDesign.title}`,
        category: originalDesign.category,
        design_data: originalDesign.designData,
        thumbnail: originalDesign.thumbnail,
        image_urls: originalDesign.imageUrls || [],
        image_timestamp: originalDesign.imageTimestamp,
        author: originalDesign.author || 'User',
        price: originalDesign.price || 0,
        language: originalDesign.language || 'en',
        region: originalDesign.region || 'US',
        popularity: 0,
        num_downloads: 0,
        search_keywords: originalDesign.searchKeywords || [],
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating design in Supabase:', error);
      throw new Error('Failed to duplicate design');
    }

    return this.mapDatabaseRecordToSavedDesign(data);
  }

  async getPublishedDesigns(): Promise<SavedDesign[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log('Fetching published designs from saved_designs table...');

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching published designs from Supabase:', error);
      throw new Error('Failed to fetch published designs');
    }

    return data.map((record) => this.mapDatabaseRecordToSavedDesign(record));
  }

  async getUserPublishedDesigns(userId: string): Promise<SavedDesign[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log('Fetching published designs for userId:', userId);

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('author_id', userId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        'Error fetching user published designs from Supabase:',
        error,
      );
      throw new Error('Failed to fetch user published designs');
    }

    console.log(`Found ${data.length} published designs in Supabase`);

    return data.map((record) => this.mapDatabaseRecordToSavedDesign(record));
  }

  async publishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    const updated = await this.updateDesign(userId, designId, {
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    });
    if (updated) {
      try {
        await this.ensureTemplateForSavedDesign(updated.id, userId);
      } catch (e) {
        console.error('publishDesign: ensureTemplateForSavedDesign failed', e);
      }
    }
    return updated;
  }

  async publishDesignWithMetadata(
    userId: string,
    designId: string,
    metadata: {
      title: string;
      description: string;
      category: string;
      searchKeywords: string[];
      language?: string;
      region?: string;
    },
  ): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log(
      `Publishing design ${designId} for user ${userId} with metadata:`,
      metadata,
    );

    const updateData = {
      status: 'published',
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      search_keywords: metadata.searchKeywords,
      language: metadata.language || 'en',
      region: metadata.region || 'US',
      upload_time: new Date().toISOString(),
      popularity: 0,
      num_downloads: 0,
      price: 0,
      updated_at: new Date().toISOString(),
    };

    console.log('Update data for publishing:', updateData);

    const { data, error } = await this.supabase
      .from('saved_designs')
      .update(updateData)
      .eq('id', designId)
      .eq('author_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error publishing design with metadata:', error);
      throw new Error('Failed to publish design');
    }

    console.log('Design published successfully:', data);
    const mapped = data ? this.mapDatabaseRecordToSavedDesign(data) : null;
    if (mapped) {
      try {
        await this.ensureTemplateForSavedDesign(mapped.id, userId);
      } catch (e) {
        console.error('publishDesignWithMetadata: ensureTemplateForSavedDesign failed', e);
      }
    }
    return mapped;
  }

  async unpublishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    // First revert status
    const reverted = await this.updateDesign(userId, designId, {
      status: 'draft',
      publishedAt: null as any,
      updatedAt: new Date(),
    });
    // Remove associated template(s)
    try {
      if (this.supabase) {
        const { error } = await this.supabase
          .from('sw_templates')
          .delete()
          .eq('original_saved_design_id', designId);
        if (error) {
          console.error('unpublishDesign: failed to delete template', error);
        }
      }
    } catch (e) {
      console.error('unpublishDesign: template cleanup error', e);
    }
    return reverted;
  }

  private mapDatabaseRecordToSavedDesign(record: any): SavedDesign {
    // Extract data from the new schema
    const metadata = record.metadata || {};

    // Create pages array from individual image columns
    const pages = [
      {
        header: 'Page 1',
        image: record.image_1 || '',
        text: '',
        footer: '',
      },
      {
        header: 'Page 2',
        image: record.image_2 || '',
        text: '',
        footer: '',
      },
      {
        header: 'Page 3',
        image: record.image_3 || '',
        text: '',
        footer: '',
      },
      {
        header: 'Page 4',
        image: record.image_4 || '',
        text: '',
        footer: '',
      },
    ]; // Keep all 4 pages for proper card display

    // Create design data with pages from individual columns or fallback to metadata
    const designData = metadata.designData || {
      templateKey: metadata.templateKey || 'custom',
      pages: pages,
      editedPages: {},
    };

    // If we have individual image columns, prioritize them over metadata
    if (record.image_1 || record.image_2 || record.image_3 || record.image_4) {
      designData.pages = pages;
      console.log('🔄 Using individual image columns for design:', record.id);
      console.log('📸 Individual images:', {
        image1: record.image_1 ? 'Present' : 'Empty',
        image2: record.image_2 ? 'Present' : 'Empty',
        image3: record.image_3 ? 'Present' : 'Empty',
        image4: record.image_4 ? 'Present' : 'Empty',
      });
    } else {
      console.log(
        '⚠️ No individual image columns found for design:',
        record.id,
        'using metadata',
      );
    }

    return {
      id: record.id,
      userId: record.author_id, // Maps to the user who created this design
      title: record.title,
      description: record.description,
      category: 'General', // Default category since we're using category_id now
      designData: designData,
      thumbnail: record.cover_image,
      imageUrls:
        metadata.imageUrls ||
        [record.image_1, record.image_2, record.image_3, record.image_4].filter(
          Boolean,
        ),
      imageTimestamp: metadata.imageTimestamp,
      author: metadata.author || 'User',
      upload_time: record.created_at,
      price: record.price || 0,
      language: record.language || 'en',
      region: record.region || 'US',
      popularity: record.popularity || 0,
      num_downloads: record.num_downloads || 0,
      searchKeywords: record.search_keywords || [],
      status: record.status as
        | 'draft'
        | 'published'
        | 'archived'
        | 'template_candidate'
        | 'published_to_templates'
        | undefined,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      // New fields for sw_templates compatibility
      templateId: metadata.templateId,
      slug: record.slug,
      categoryId: record.category_id,
      authorId: record.author_id,
      createdByUserId: metadata.createdByUserId || record.author_id,
      coverImage: metadata.coverImage || record.cover_image,
      // Use individual image columns
      image1: record.image_1,
      image2: record.image_2,
      image3: record.image_3,
      image4: record.image_4,
      isFeatured: metadata.isFeatured || false,
      isUserGenerated: record.is_user_generated || true,
      tags: record.tags || [],
      currentVersion: metadata.currentVersion,
      publishedAt: record.published_at
        ? new Date(record.published_at)
        : undefined,
      sourceTemplateId:
        metadata.sourceTemplateId || record.original_saved_design_id,
    };
  }

  // New methods for sw_templates compatibility

  /**
   * Copy a template from sw_templates to saved_designs for user editing
   */
  async copyFromTemplate(
    templateId: string,
    userId: string,
    title?: string,
  ): Promise<SavedDesign | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log(`Copying template ${templateId} for user ${userId}`);

    // Use the SQL function to copy template to saved_designs
    const { data, error } = await this.supabase.rpc(
      'copy_template_to_saved_design',
      {
        p_template_id: templateId,
        p_user_id: userId,
        p_title: title || null,
      },
    );

    if (error) {
      console.error('Error copying template:', error);
      throw new Error('Failed to copy template');
    }

    if (!data) {
      return null;
    }

    // Fetch the created saved design
    const { data: savedDesign, error: fetchError } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) {
      console.error('Error fetching copied design:', fetchError);
      throw new Error('Failed to fetch copied design');
    }

    return savedDesign
      ? this.mapDatabaseRecordToSavedDesign(savedDesign)
      : null;
  }

  /**
   * Publish a saved design back to sw_templates
   */
  async publishToTemplates(
    designId: string,
    userId: string,
  ): Promise<{ templateId: string; savedDesign: SavedDesign } | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log(
      `Publishing design ${designId} to templates for user ${userId}`,
    );

    // Use the SQL function to publish saved_design to templates
    const { data, error } = await this.supabase.rpc(
      'publish_saved_design_to_templates',
      {
        p_design_id: designId,
        p_user_id: userId,
      },
    );

    if (error) {
      console.error('Error publishing to templates:', error);
      throw new Error('Failed to publish to templates');
    }

    if (!data) {
      return null;
    }

    // Fetch the updated saved design
    const { data: savedDesign, error: fetchError } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .single();

    if (fetchError) {
      console.error('Error fetching published design:', fetchError);
      throw new Error('Failed to fetch published design');
    }

    if (!savedDesign) {
      throw new Error('Failed to fetch updated saved design');
    }

    return {
      templateId: data,
      savedDesign: this.mapDatabaseRecordToSavedDesign(savedDesign),
    };
  }

  /**
   * Promote a saved_design row to sw_templates (direct insert with defaults).
   * Unlike publishToTemplates (RPC), this performs explicit mapping & default assignment.
   */
  async promoteToTemplate(
    designId: string,
    userId: string,
  ): Promise<{ template: any; savedDesign: SavedDesign } | null> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // 1. Fetch saved design (ensure ownership)
    const { data: designRecord, error: designError } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .eq('author_id', userId)
      .single();

    if (designError) {
      console.error('promoteToTemplate: design fetch error', designError);
      return null;
    }

    // 2. Prepare slug helper
    const makeSlug = (title: string) =>
      (title || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    let baseSlug = makeSlug(designRecord.title || 'untitled-design');
    let finalSlug = baseSlug;

    // 3. Ensure slug uniqueness
    let slugCounter = 1;
    while (true) {
      const { data: existing, error: slugError } = await this.supabase
        .from('sw_templates')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle();
      if (slugError) {
        console.warn('promoteToTemplate: slug check warning', slugError.message);
        break; // fallback to current slug
      }
      if (!existing) break;
      slugCounter++;
      finalSlug = `${baseSlug}-${slugCounter}`;
    }

    const metadata = designRecord.metadata || {};

    // 4. Build template insert object with defaults
    const nowIso = new Date().toISOString();
    // sw_templates actual columns (from CSV): slug,title,category_id,author_id,description,price,language,region,status,popularity,num_downloads,cover_image,current_version,published_at,is_user_generated,original_saved_design_id,image_1..image_4,search_keywords,tags,metadata
    const templateInsert: any = {
      slug: finalSlug,
      title: designRecord.title || 'Untitled Design',
      description: designRecord.description || null,
      category_id: designRecord.category_id || null,
      author_id: designRecord.author_id || userId,
      price: designRecord.price ?? 0,
      language: designRecord.language || 'en',
      region: designRecord.region || 'US',
      status: 'published',
      popularity: designRecord.popularity ?? 0,
      num_downloads: designRecord.num_downloads ?? 0,
      cover_image: designRecord.cover_image || designRecord.image_1 || null,
      current_version: metadata.currentVersion || '1.0.0',
      published_at: nowIso,
      is_user_generated: designRecord.is_user_generated ?? true,
      original_saved_design_id: designRecord.original_saved_design_id || null,
      image_1: designRecord.image_1 || null,
      image_2: designRecord.image_2 || null,
      image_3: designRecord.image_3 || null,
      image_4: designRecord.image_4 || null,
      search_keywords: designRecord.search_keywords || [],
      tags: designRecord.tags || [],
      metadata: {
        ...(designRecord.metadata || {}),
        promotedFromSavedDesignId: designId,
        promotedAt: nowIso,
        // Store design pages inside metadata for potential use
        designData: metadata.designData || {
          templateKey: metadata.templateKey || 'custom',
          pages: [
            { header: 'Page 1', image: designRecord.image_1 || '', text: '', footer: '' },
            { header: 'Page 2', image: designRecord.image_2 || '', text: '', footer: '' },
            { header: 'Page 3', image: designRecord.image_3 || '', text: '', footer: '' },
            { header: 'Page 4', image: designRecord.image_4 || '', text: '', footer: '' },
          ],
        },
      },
    };

    // 5. Insert into sw_templates
    const { data: templateRow, error: insertError } = await this.supabase
      .from('sw_templates')
      .insert(templateInsert)
      .select('*')
      .single();

    if (insertError) {
      console.error('promoteToTemplate: insert error', insertError);
      throw new Error('Failed to promote design to template');
    }

    // 6. Update saved_design metadata & status with templateId reference
    const newMetadata = {
      ...metadata,
      templateId: templateRow.id,
      currentVersion: templateInsert.current_version,
    };
    const { data: updatedDesign, error: updateError } = await this.supabase
      .from('saved_designs')
      .update({
        status: 'published_to_templates',
        metadata: newMetadata,
        published_at: nowIso,
        updated_at: nowIso,
        slug: templateRow.slug,
      })
      .eq('id', designId)
      .select('*')
      .single();

    if (updateError) {
      console.error('promoteToTemplate: saved_design update error', updateError);
    }

    return {
      template: templateRow,
      savedDesign: this.mapDatabaseRecordToSavedDesign(updatedDesign || designRecord),
    };
  }

  /**
   * Ensure a template exists for a saved design (idempotent). Called during publish.
   */
  private async ensureTemplateForSavedDesign(
    designId: string,
    userId: string,
  ): Promise<void> {
    if (!this.supabase) return;
    // Already have a template?
    const { data: existingTemplate, error: existingError } = await this.supabase
      .from('sw_templates')
      .select('id')
      .eq('original_saved_design_id', designId)
      .maybeSingle();
    if (existingError) {
      console.warn('ensureTemplateForSavedDesign: existing check error', existingError.message);
    }
    if (existingTemplate) return;
    // Fetch saved design record
    const { data: designRecord, error: designError } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .single();
    if (designError || !designRecord) return;
    // Reuse logic via promoteToTemplate but without status mutation (avoid recursion)
    try {
      await this.promoteToTemplate(designId, userId);
    } catch (e) {
      console.error('ensureTemplateForSavedDesign: promote failed', e);
    }
  }

  /**
   * Get templates that can be copied (from sw_templates)
   */
  async getAvailableTemplates(
    userId?: string,
    category?: string,
    limit = 20,
    offset = 0,
  ): Promise<any[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log(
      `Getting available templates for user ${userId}, category: ${category}`,
    );

    let query = this.supabase
      .from('sw_templates')
      .select(
        `
        *,
        sw_categories(name)
      `,
      )
  .eq('status', 'published')
  // Order newest (most recently published) first; fall back to created_at for any rows lacking published_at
  .order('published_at', { ascending: false, nullsFirst: false })
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category_id', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching available templates:', error);
      throw new Error('Failed to fetch available templates');
    }

    return data || [];
  }

  /**
   * Get designs that have been published to templates
   */
  async getPublishedToTemplates(userId: string): Promise<SavedDesign[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    console.log(`Getting published to templates for user ${userId}`);

    const { data, error } = await this.supabase
      .from('saved_designs')
      .select('*')
      .eq('author_id', userId)
      .eq('status', 'published_to_templates')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching published to templates:', error);
      throw new Error('Failed to fetch published to templates');
    }

    return data
      ? data.map((record) => this.mapDatabaseRecordToSavedDesign(record))
      : [];
  }

  /**
   * Copy an image from one location to another in Supabase Storage
   */
  async copyImage(originalImageUrl: string, userId: string): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      // Extract the file path from the URL
      const urlParts = originalImageUrl.split('/');
      const bucketName = 'smartwish-assets'; // Based on your URL structure
      const originalPath = urlParts
        .slice(urlParts.indexOf('smartwish-assets') + 1)
        .join('/');

      // Generate a new path for the copied image
      const timestamp = Date.now();
      const fileName = originalPath.split('/').pop() || 'image.png';
      const fileExtension = fileName.split('.').pop() || 'png';
      const baseFileName = fileName.replace(`.${fileExtension}`, '');
      const newFileName = `${baseFileName}_copy_${timestamp}.${fileExtension}`;
      const newPath = `users/${userId}/designs/copied_images/${newFileName}`;

      // Download the original image
      const { data: originalData, error: downloadError } =
        await this.supabase.storage.from(bucketName).download(originalPath);

      if (downloadError) {
        console.error('Error downloading original image:', downloadError);
        throw new Error(
          `Failed to download original image: ${downloadError.message}`,
        );
      }

      // Upload the image to the new location
      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from(bucketName)
          .upload(newPath, originalData, {
            contentType: originalData.type,
            upsert: false,
          });

      if (uploadError) {
        console.error('Error uploading copied image:', uploadError);
        throw new Error(
          `Failed to upload copied image: ${uploadError.message}`,
        );
      }

      // Generate the public URL for the new image
      const { data: publicUrlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(newPath);

      if (!publicUrlData.publicUrl) {
        throw new Error('Failed to generate public URL for copied image');
      }

      console.log(
        `Image copied successfully: ${originalImageUrl} -> ${publicUrlData.publicUrl}`,
      );
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error copying image:', error);
      // Return the original URL as fallback
      return originalImageUrl;
    }
  }
}
