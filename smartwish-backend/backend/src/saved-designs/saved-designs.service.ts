import { Injectable } from '@nestjs/common';
import { SupabaseSavedDesignsService } from './supabase-saved-designs.service';

export interface SavedDesign {
  id: string;
  userId: string;
  title: string;
  description: string;
  designData: {
    templateKey: string;
    pages: Array<{ header: string; image: string; text: string; footer: string }>;
    editedPages: Record<number, string>;
  };
  thumbnail?: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrls?: string[];
  imageTimestamp?: number;
  author?: string;
  upload_time?: string;
  price?: number;
  language?: string;
  region?: string;
  popularity?: number;
  num_downloads?: number;
  searchKeywords?: string[];
  status?: 'draft' | 'published' | 'archived' | 'template_candidate' | 'published_to_templates';
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
export class SavedDesignsService {
  private supabaseService: SupabaseSavedDesignsService;

  constructor() {
    this.supabaseService = new SupabaseSavedDesignsService();
    if (!this.supabaseService.isAvailable()) {
      throw new Error('Supabase is required for saved designs functionality. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
  }

  private ensurePages(designData: any) {
    if (!designData.designData) {
      designData.designData = { templateKey: 'unknown', pages: [], editedPages: {} };
    } else {
      if (!Array.isArray(designData.designData.pages)) designData.designData.pages = [];
      if (!designData.designData.editedPages) designData.designData.editedPages = {};
    }
  }

  async saveDesign(
    userId: string,
    designData: Omit<SavedDesign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<SavedDesign> {
    this.ensurePages(designData as any);
    return await this.supabaseService.saveDesign(userId, designData as any);
  }

  async getUserDesigns(userId: string): Promise<SavedDesign[]> {
    console.log('SavedDesignsService: Getting designs for userId:', userId);
    const designs = await this.supabaseService.getUserDesigns(userId);
    console.log(
      'SavedDesignsService: Found designs count:',
      designs.length,
    );
    return designs;
  }

  async getDesignById(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    return await this.supabaseService.getDesignById(userId, designId);
  }

  async getPublicDesignById(designId: string): Promise<SavedDesign | null> {
    return await this.supabaseService.getPublicDesignById(designId);
  }

  async updateDesign(
    userId: string,
    designId: string,
    updates: Partial<SavedDesign>,
  ): Promise<SavedDesign | null> {
    if (updates.designData) this.ensurePages(updates as any);
    return await this.supabaseService.updateDesign(userId, designId, updates as any);
  }

  async deleteDesign(userId: string, designId: string): Promise<boolean> {
    return await this.supabaseService.deleteDesign(userId, designId);
  }

  async duplicateDesign(
    userId: string,
    designId: string,
    title?: string,
  ): Promise<SavedDesign | null> {
    // Get the original design
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
      
      while (existingDesigns.some(design => design.title === duplicateTitle)) {
        counter++;
        duplicateTitle = `${baseName} - Copy ${counter}`;
      }
    }

    // Copy images if they exist and create new URLs
    let copiedImageUrls: string[] = [];
    let copiedThumbnail: string | undefined;
    
    try {
      // Copy thumbnail if it exists
      if (originalDesign.thumbnail) {
        copiedThumbnail = await this.supabaseService.copyImage(originalDesign.thumbnail, userId);
      }

      // Copy image URLs if they exist
      if (originalDesign.imageUrls && originalDesign.imageUrls.length > 0) {
        copiedImageUrls = await Promise.all(
          originalDesign.imageUrls.map(url => 
            this.supabaseService.copyImage(url, userId)
          )
        );
      }

      // Copy images from design data pages
      let copiedDesignData = { ...originalDesign.designData };
      if (!Array.isArray(copiedDesignData.pages)) copiedDesignData.pages = [];
      copiedDesignData.pages = await Promise.all(
        copiedDesignData.pages.map(async (page: any) => {
          const img = page.image;
            if (img && img.includes('supabase')) {
              try {
                const copiedImage = await this.supabaseService.copyImage(img, userId);
                return { ...page, image: copiedImage };
              } catch {
                return page;
              }
            }
            return page;
        })
      );

      // Create the duplicate with copied images
      const duplicateData = {
        title: duplicateTitle,
        description: originalDesign.description || `Copy of ${originalDesign.title}`,
        category: originalDesign.category,
  designData: copiedDesignData,
        thumbnail: copiedThumbnail,
        imageUrls: copiedImageUrls,
        imageTimestamp: Date.now(),
        author: originalDesign.author || 'User',
        price: originalDesign.price || 0,
        language: originalDesign.language || 'en',
        region: originalDesign.region || 'US',
        popularity: 0,
        num_downloads: 0,
        searchKeywords: originalDesign.searchKeywords || [],
        status: 'draft' as const,
        // Copy template-related fields
        templateId: originalDesign.templateId,
        slug: undefined, // Generate new slug
        categoryId: originalDesign.categoryId,
        authorId: originalDesign.authorId,
        createdByUserId: userId,
        sourceTemplateId: originalDesign.sourceTemplateId,
        tags: originalDesign.tags,
        currentVersion: originalDesign.currentVersion,
      };

      return await this.saveDesign(userId, duplicateData);
    } catch (error) {
      console.error('Error copying images during duplication:', error);
      // Fallback: create duplicate without copying images
      const duplicateData = {
        title: duplicateTitle,
        description: originalDesign.description || `Copy of ${originalDesign.title}`,
        category: originalDesign.category,
  designData: originalDesign.designData,
        thumbnail: originalDesign.thumbnail,
        imageUrls: originalDesign.imageUrls,
        imageTimestamp: originalDesign.imageTimestamp,
        author: originalDesign.author || 'User',
        price: originalDesign.price || 0,
        language: originalDesign.language || 'en',
        region: originalDesign.region || 'US',
        popularity: 0,
        num_downloads: 0,
        searchKeywords: originalDesign.searchKeywords || [],
        status: 'draft' as const,
        templateId: originalDesign.templateId,
        slug: undefined,
        categoryId: originalDesign.categoryId,
        authorId: originalDesign.authorId,
        createdByUserId: userId,
        sourceTemplateId: originalDesign.sourceTemplateId,
        tags: originalDesign.tags,
        currentVersion: originalDesign.currentVersion,
      };

      return await this.saveDesign(userId, duplicateData);
    }
  }

  async getPublishedDesigns(): Promise<SavedDesign[]> {
    return await this.supabaseService.getPublishedDesigns();
  }

  async getUserPublishedDesigns(userId: string): Promise<SavedDesign[]> {
    console.log('SavedDesignsService: Getting published designs for userId:', userId);
    const designs = await this.supabaseService.getUserPublishedDesigns(userId);
    console.log('SavedDesignsService: Found published designs count:', designs.length);
    return designs;
  }

  async publishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    return await this.supabaseService.publishDesign(userId, designId);
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
    return await this.supabaseService.publishDesignWithMetadata(userId, designId, metadata);
  }

  async unpublishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    return await this.supabaseService.unpublishDesign(userId, designId);
  }

  async createSharedCopy(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    // Get the original design
    const originalDesign = await this.getDesignById(userId, designId);
    if (!originalDesign) {
      return null;
    }

    // Create a shared copy with public visibility
    const sharedData = {
      ...originalDesign,
      title: `${originalDesign.title} (Shared)`,
      userId, // Keep original user
      status: 'published' as const,
    };

    // Remove fields that shouldn't be copied
    delete (sharedData as any).id;
    delete (sharedData as any).createdAt;
    delete (sharedData as any).updatedAt;

    return await this.saveDesign(userId, sharedData);
  }

  // New methods for sw_templates compatibility

  async copyFromTemplate(
    templateId: string,
    userId: string,
    title?: string,
  ): Promise<SavedDesign | null> {
    return await this.supabaseService.copyFromTemplate(templateId, userId, title);
  }

  async publishToTemplates(
    designId: string,
    userId: string,
  ): Promise<{ templateId: string; savedDesign: SavedDesign } | null> {
    return await this.supabaseService.publishToTemplates(designId, userId);
  }

  // promoteToTemplate removed: publish handles template creation internally

  async getAvailableTemplates(
    userId?: string,
    category?: string,
    limit = 20,
    offset = 0,
  ): Promise<any[]> {
    return await this.supabaseService.getAvailableTemplates(userId, category, limit, offset);
  }

  async getPublishedToTemplates(userId: string): Promise<SavedDesign[]> {
    return await this.supabaseService.getPublishedToTemplates(userId);
  }
}