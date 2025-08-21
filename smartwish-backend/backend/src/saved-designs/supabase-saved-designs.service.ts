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
  status?: 'draft' | 'published' | 'archived' | 'template_candidate' | 'published_to_templates';
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
      console.warn('SUPABASE_URL not found, using fallback file-based storage');
      return;
    }

    if (!serviceRoleKey && !anonKey) {
      console.warn(
        'Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY found, using fallback file-based storage',
      );
      return;
    }

    // Prefer service role key for better permissions
    const supabaseKey = serviceRoleKey || anonKey;
    if (!supabaseKey) {
      console.warn('No Supabase key found, using fallback file-based storage');
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

    const { data, error } = await this.supabase
      .from('saved_designs')
      .insert({
        user_id: userId,
        title: designData.title,
        description: designData.description,
        category: designData.category,
        design_data: designData.designData,
        thumbnail: designData.thumbnail,
        image_urls: designData.imageUrls || [],
        image_timestamp: designData.imageTimestamp,
        author: designData.author || 'User',
        price: designData.price || 0,
        language: designData.language || 'en',
        region: designData.region || 'US',
        popularity: designData.popularity || 0,
        num_downloads: designData.num_downloads || 0,
        search_keywords: designData.searchKeywords || [],
        status: designData.status || 'draft',
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
      .eq('user_id', userId)
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
      .eq('user_id', userId)
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

    const updateData: {
      title?: string;
      description?: string;
      category?: string;
      design_data?: any;
      thumbnail?: string;
      image_urls?: string[];
      image_timestamp?: number;
      author?: string;
      price?: number;
      language?: string;
      region?: string;
      popularity?: number;
      num_downloads?: number;
      search_keywords?: string[];
      status?: 'draft' | 'published' | 'archived' | 'template_candidate' | 'published_to_templates';
      // New fields for sw_templates compatibility
      template_id?: string;
      slug?: string;
      category_id?: string;
      author_id?: string;
      created_by_user_id?: string;
      cover_image?: string;
      image_1?: string;
      image_2?: string;
      image_3?: string;
      image_4?: string;
      is_featured?: boolean;
      is_user_generated?: boolean;
      tags?: string[];
      current_version?: string;
      published_at?: Date;
      source_template_id?: string;
    } = {};

    if (updates.title) updateData.title = updates.title;
    if (updates.description) updateData.description = updates.description;
    if (updates.category) updateData.category = updates.category;
    if (updates.designData) updateData.design_data = updates.designData;
    if (updates.thumbnail) updateData.thumbnail = updates.thumbnail;
    if (updates.imageUrls) updateData.image_urls = updates.imageUrls;
    if (updates.imageTimestamp)
      updateData.image_timestamp = updates.imageTimestamp;
    if (updates.author) updateData.author = updates.author;
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
    
    // New field mappings for sw_templates compatibility
    if (updates.templateId) updateData.template_id = updates.templateId;
    if (updates.slug) updateData.slug = updates.slug;
    if (updates.categoryId) updateData.category_id = updates.categoryId;
    if (updates.authorId) updateData.author_id = updates.authorId;
    if (updates.createdByUserId) updateData.created_by_user_id = updates.createdByUserId;
    if (updates.coverImage) updateData.cover_image = updates.coverImage;
    if (updates.image1) updateData.image_1 = updates.image1;
    if (updates.image2) updateData.image_2 = updates.image2;
    if (updates.image3) updateData.image_3 = updates.image3;
    if (updates.image4) updateData.image_4 = updates.image4;
    if (updates.isFeatured !== undefined) updateData.is_featured = updates.isFeatured;
    if (updates.isUserGenerated !== undefined) updateData.is_user_generated = updates.isUserGenerated;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.currentVersion) updateData.current_version = updates.currentVersion;
    if (updates.publishedAt) updateData.published_at = updates.publishedAt;
    if (updates.sourceTemplateId) updateData.source_template_id = updates.sourceTemplateId;

    const { data, error } = await this.supabase
      .from('saved_designs')
      .update(updateData)
      .eq('id', designId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating design in Supabase:', error);
      return null;
    }

    return this.mapDatabaseRecordToSavedDesign(data);
  }

  async deleteDesign(userId: string, designId: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await this.supabase
      .from('saved_designs')
      .delete()
      .eq('id', designId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting design from Supabase:', error);
      return false;
    }

    return true;
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

    console.log(`Found ${data.length} published designs in Supabase`);

    return data.map((record) => this.mapDatabaseRecordToSavedDesign(record));
  }

  async publishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    return this.updateDesign(userId, designId, { status: 'published' });
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
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error publishing design with metadata:', error);
      throw new Error('Failed to publish design');
    }

    console.log('Design published successfully:', data);
    return data ? this.mapDatabaseRecordToSavedDesign(data) : null;
  }

  async unpublishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    return this.updateDesign(userId, designId, { status: 'draft' });
  }

  private mapDatabaseRecordToSavedDesign(record: {
    id: string;
    user_id: string;
    title: string;
    description: string;
    category: string;
    design_data: any;
    thumbnail?: string;
    image_urls?: string[];
    image_timestamp?: number;
    author?: string;
    upload_time?: string;
    price?: number;
    language?: string;
    region?: string;
    popularity?: number;
    num_downloads?: number;
    search_keywords?: string[];
    status?: string;
    created_at: string;
    updated_at: string;
    // New fields
    template_id?: string;
    slug?: string;
    category_id?: string;
    author_id?: string;
    created_by_user_id?: string;
    cover_image?: string;
    image_1?: string;
    image_2?: string;
    image_3?: string;
    image_4?: string;
    is_featured?: boolean;
    is_user_generated?: boolean;
    tags?: string[];
    current_version?: string;
    published_at?: string;
    source_template_id?: string;
  }): SavedDesign {
    // With deterministic mapping, return the stored user_id as-is
    const originalUserId = record.user_id;

    return {
      id: record.id,
      userId: originalUserId,
      title: record.title,
      description: record.description,
      category: record.category,
      designData: record.design_data,
      thumbnail: record.thumbnail,
      imageUrls: record.image_urls,
      imageTimestamp: record.image_timestamp,
      author: record.author,
      upload_time: record.upload_time,
      price: record.price,
      language: record.language,
      region: record.region,
      popularity: record.popularity,
      num_downloads: record.num_downloads,
      searchKeywords: record.search_keywords,
      status: record.status as 'draft' | 'published' | 'archived' | 'template_candidate' | 'published_to_templates' | undefined,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      // New fields for sw_templates compatibility
      templateId: record.template_id,
      slug: record.slug,
      categoryId: record.category_id,
      authorId: record.author_id,
      createdByUserId: record.created_by_user_id,
      coverImage: record.cover_image,
      image1: record.image_1,
      image2: record.image_2,
      image3: record.image_3,
      image4: record.image_4,
      isFeatured: record.is_featured,
      isUserGenerated: record.is_user_generated,
      tags: record.tags,
      currentVersion: record.current_version,
      publishedAt: record.published_at ? new Date(record.published_at) : undefined,
      sourceTemplateId: record.source_template_id,
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
    const { data, error } = await this.supabase.rpc('copy_template_to_saved_design', {
      p_template_id: templateId,
      p_user_id: userId,
      p_title: title || null,
    });

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

    return savedDesign ? this.mapDatabaseRecordToSavedDesign(savedDesign) : null;
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

    console.log(`Publishing design ${designId} to templates for user ${userId}`);

    // Use the SQL function to publish saved_design to templates
    const { data, error } = await this.supabase.rpc('publish_saved_design_to_templates', {
      p_design_id: designId,
      p_user_id: userId,
    });

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

    console.log(`Getting available templates for user ${userId}, category: ${category}`);

    let query = this.supabase
      .from('sw_templates')
      .select(`
        *,
        sw_categories(name)
      `)
      .eq('status', 'published')
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
      .eq('user_id', userId)
      .eq('status', 'published_to_templates')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching published to templates:', error);
      throw new Error('Failed to fetch published to templates');
    }

    return data ? data.map(record => this.mapDatabaseRecordToSavedDesign(record)) : [];
  }
}
