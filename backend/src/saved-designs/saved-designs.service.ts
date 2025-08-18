import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseSavedDesignsService } from './supabase-saved-designs.service';

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
  status?: 'draft' | 'published' | 'archived';
}

@Injectable()
export class SavedDesignsService {
  private readonly designsDir = path.join(
    process.cwd(),
    'downloads',
    'saved-designs',
  );
  private supabaseService: SupabaseSavedDesignsService;

  constructor() {
    // Ensure the designs directory exists
    if (!fs.existsSync(this.designsDir)) {
      fs.mkdirSync(this.designsDir, { recursive: true });
    }

    // Initialize Supabase service
    this.supabaseService = new SupabaseSavedDesignsService();
  }

  private getUserDesignsFile(userId: string): string {
    return path.join(this.designsDir, `user-${userId}-designs.json`);
  }

  private loadUserDesigns(userId: string): SavedDesign[] {
    const filePath = this.getUserDesignsFile(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading designs for user ${userId}:`, error);
      return [];
    }
  }

  private saveUserDesigns(userId: string, designs: SavedDesign[]): void {
    const filePath = this.getUserDesignsFile(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(designs, null, 2));
    } catch (error) {
      console.error(`Error saving designs for user ${userId}:`, error);
      throw new Error('Failed to save design');
    }
  }

  async saveDesign(
    userId: string,
    designData: Omit<SavedDesign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<SavedDesign> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.saveDesign(userId, designData);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const designs = this.loadUserDesigns(userId);
      const newDesign: SavedDesign = {
        ...designData,
        userId,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        // Set default metadata if not provided
        author: designData.author || 'User',
        upload_time: designData.upload_time || new Date().toISOString(),
        price: designData.price || 0,
        language: designData.language || 'en',
        region: designData.region || 'US',
        popularity: designData.popularity || 0,
        num_downloads: designData.num_downloads || 0,
        searchKeywords: designData.searchKeywords || [],
        status: designData.status || 'draft',
      };

      designs.push(newDesign);
      this.saveUserDesigns(userId, designs);

      return newDesign;
    }
  }

  async getUserDesigns(userId: string): Promise<SavedDesign[]> {
    console.log('SavedDesignsService: Getting designs for userId:', userId);
    try {
      // Try to use Supabase first
      const designs = await this.supabaseService.getUserDesigns(userId);
      console.log(
        'SavedDesignsService: Found designs count (Supabase):',
        designs.length,
      );
      return designs;
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const designs = this.loadUserDesigns(userId);
      console.log(
        'SavedDesignsService: Found designs count (File):',
        designs.length,
      );
      return designs;
    }
  }

  async getDesignById(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.getDesignById(userId, designId);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const designs = this.loadUserDesigns(userId);
      return designs.find((design) => design.id === designId) || null;
    }
  }

  async getPublicDesignById(designId: string): Promise<SavedDesign | null> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.getPublicDesignById(designId);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      // First check if it's a shared design
      const sharedDesignsFile = path.join(
        this.designsDir,
        'shared-designs.json',
      );
      if (fs.existsSync(sharedDesignsFile)) {
        try {
          const data = fs.readFileSync(sharedDesignsFile, 'utf8');
          const sharedDesigns = JSON.parse(data);
          const sharedDesign = sharedDesigns.find(
            (d: SavedDesign) => d.id === designId,
          );
          if (sharedDesign) {
            return sharedDesign;
          }
        } catch (error) {
          console.error('Error reading shared designs file:', error);
        }
      }

      // If not found in shared designs, search through all user design files
      if (!fs.existsSync(this.designsDir)) {
        return null;
      }

      const userFiles = fs.readdirSync(this.designsDir);

      for (const userFile of userFiles) {
        if (userFile.endsWith('.json') && userFile !== 'shared-designs.json') {
          const filePath = path.join(this.designsDir, userFile);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const designs = JSON.parse(data);
            const design = designs.find((d: SavedDesign) => d.id === designId);
            if (design) {
              return design;
            }
          } catch (error) {
            console.error(`Error reading file ${userFile}:`, error);
            continue;
          }
        }
      }

      return null;
    }
  }

  async updateDesign(
    userId: string,
    designId: string,
    updates: Partial<SavedDesign>,
  ): Promise<SavedDesign | null> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.updateDesign(userId, designId, updates);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const designs = this.loadUserDesigns(userId);
      const designIndex = designs.findIndex((design) => design.id === designId);

      if (designIndex === -1) {
        return null;
      }

      designs[designIndex] = {
        ...designs[designIndex],
        ...updates,
        updatedAt: new Date(),
      };

      this.saveUserDesigns(userId, designs);
      return designs[designIndex];
    }
  }

  async deleteDesign(userId: string, designId: string): Promise<boolean> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.deleteDesign(userId, designId);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const designs = this.loadUserDesigns(userId);
      const initialLength = designs.length;
      const filteredDesigns = designs.filter(
        (design) => design.id !== designId,
      );

      if (filteredDesigns.length === initialLength) {
        return false; // Design not found
      }

      this.saveUserDesigns(userId, filteredDesigns);
      return true;
    }
  }

  async publishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.publishDesign(userId, designId);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      return await this.updateDesign(userId, designId, { status: 'published' });
    }
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
    try {
      // Try to use Supabase first
      return await this.supabaseService.publishDesignWithMetadata(
        userId,
        designId,
        metadata,
      );
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      const updateData = {
        status: 'published' as const,
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        searchKeywords: metadata.searchKeywords,
        language: metadata.language || 'en',
        region: metadata.region || 'US',
        upload_time: new Date().toISOString(),
        popularity: 0,
        num_downloads: 0,
        price: 0,
      };

      return await this.updateDesign(userId, designId, updateData);
    }
  }

  async unpublishDesign(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    try {
      // Try to use Supabase first
      return await this.supabaseService.unpublishDesign(userId, designId);
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage
      return await this.updateDesign(userId, designId, { status: 'draft' });
    }
  }

  async getPublishedDesigns(): Promise<SavedDesign[]> {
    try {
      console.log('Attempting to fetch published designs from Supabase...');
      // Try to use Supabase first
      const supabaseResults = await this.supabaseService.getPublishedDesigns();
      console.log(
        `Successfully fetched ${supabaseResults.length} published designs from Supabase`,
      );
      return supabaseResults;
    } catch (error) {
      console.log(
        'Supabase not available, falling back to file storage:',
        error.message,
      );

      // Fallback to file-based storage - search through all user files for published designs
      const publishedDesigns: SavedDesign[] = [];

      if (!fs.existsSync(this.designsDir)) {
        console.log('Designs directory does not exist, returning empty array');
        return publishedDesigns;
      }

      const userFiles = fs.readdirSync(this.designsDir);
      console.log(
        `Found ${userFiles.length} user design files to check for published designs`,
      );

      for (const userFile of userFiles) {
        if (userFile.endsWith('.json')) {
          const filePath = path.join(this.designsDir, userFile);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const designs = JSON.parse(data);
            const published = designs.filter(
              (d: SavedDesign) => d.status === 'published',
            );
            if (published.length > 0) {
              console.log(
                `Found ${published.length} published designs in ${userFile}`,
              );
            }
            publishedDesigns.push(...published);
          } catch (error) {
            console.error(`Error reading file ${userFile}:`, error);
            continue;
          }
        }
      }

      console.log(
        `Total published designs found in file storage: ${publishedDesigns.length}`,
      );
      return publishedDesigns;
    }
  }

  async createSharedCopy(
    userId: string,
    designId: string,
  ): Promise<SavedDesign | null> {
    // Find the original design
    const originalDesign = await this.getDesignById(userId, designId);
    if (!originalDesign) {
      return null;
    }

    // Create a new unique ID for the shared copy
    const sharedId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create a deep copy of the design data
    const sharedDesignData = JSON.parse(
      JSON.stringify(originalDesign.designData),
    );

    // Copy images to shared location and update paths
    if (sharedDesignData.pages) {
      for (let i = 0; i < sharedDesignData.pages.length; i++) {
        const page = sharedDesignData.pages[i];
        if (page.image) {
          const newImagePath = await this.copyImageToShared(
            page.image,
            sharedId,
            i,
          );
          page.image = newImagePath;
        }
      }
    }

    // Copy edited pages if they exist
    if (sharedDesignData.editedPages) {
      const newEditedPages: Record<number, string> = {};
      for (const [pageIndex, imagePath] of Object.entries(
        sharedDesignData.editedPages,
      )) {
        const newImagePath = await this.copyImageToShared(
          imagePath as string,
          sharedId,
          parseInt(pageIndex),
        );
        newEditedPages[parseInt(pageIndex)] = newImagePath;
      }
      sharedDesignData.editedPages = newEditedPages;
    }

    // Create the shared design object
    const sharedDesign: SavedDesign = {
      ...originalDesign,
      id: sharedId,
      title: `${originalDesign.title} (Shared Copy)`,
      description: originalDesign.description,
      designData: sharedDesignData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save the shared design to a special shared designs file
    await this.saveSharedDesign(sharedDesign);

    return sharedDesign;
  }

  private async copyImageToShared(
    originalImagePath: string,
    sharedId: string,
    pageIndex: number,
  ): Promise<string> {
    try {
      // Extract filename from path
      const pathParts = originalImagePath.split('/');
      const filename = pathParts[pathParts.length - 1];
      const extension = filename.split('.').pop() || 'jpg';

      // Create new filename for shared copy
      const newFilename = `shared_${sharedId}_page_${pageIndex}.${extension}`;
      const sharedImagesDir = path.join(
        process.cwd(),
        'public',
        'shared-images',
      );

      // Ensure shared images directory exists
      if (!fs.existsSync(sharedImagesDir)) {
        fs.mkdirSync(sharedImagesDir, { recursive: true });
      }

      const originalFilePath = path.join(
        process.cwd(),
        'public',
        originalImagePath,
      );
      const newFilePath = path.join(sharedImagesDir, newFilename);

      // Copy the file
      if (fs.existsSync(originalFilePath)) {
        fs.copyFileSync(originalFilePath, newFilePath);
        return `shared-images/${newFilename}`;
      } else {
        console.warn(`Original image file not found: ${originalFilePath}`);
        return originalImagePath; // Fallback to original path
      }
    } catch (error) {
      console.error('Error copying image to shared location:', error);
      return originalImagePath; // Fallback to original path
    }
  }

  private async saveSharedDesign(sharedDesign: SavedDesign): Promise<void> {
    const sharedDesignsFile = path.join(this.designsDir, 'shared-designs.json');
    let sharedDesigns: SavedDesign[] = [];

    if (fs.existsSync(sharedDesignsFile)) {
      try {
        const data = fs.readFileSync(sharedDesignsFile, 'utf8');
        sharedDesigns = JSON.parse(data);
      } catch (error) {
        console.error('Error loading shared designs:', error);
        sharedDesigns = [];
      }
    }

    sharedDesigns.push(sharedDesign);

    try {
      fs.writeFileSync(
        sharedDesignsFile,
        JSON.stringify(sharedDesigns, null, 2),
      );
    } catch (error) {
      console.error('Error saving shared design:', error);
      throw new Error('Failed to save shared design');
    }
  }
}
