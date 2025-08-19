import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn(
        'Supabase Storage not configured - missing URL or service role key',
      );
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log('✅ Supabase Storage service initialized');
  }

  /**
   * Upload a base64 image to Supabase Storage
   */
  async uploadImage(
    base64Data: string,
    filename: string,
    folder: string = 'card-images',
  ): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    try {
      // Convert base64 to buffer
      const base64WithoutPrefix = base64Data.replace(
        /^data:image\/[a-z]+;base64,/,
        '',
      );
      const buffer = Buffer.from(base64WithoutPrefix, 'base64');

      // Create unique filename with timestamp
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${filename}`;
      const filePath = `${folder}/${uniqueFilename}`;

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('smartwish-assets')
        .upload(filePath, buffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading to Supabase Storage:', error);
        throw new Error('Failed to upload image to cloud storage');
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('smartwish-assets')
        .getPublicUrl(filePath);

      console.log(`✅ Image uploaded to cloud: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw new Error('Failed to upload image to cloud storage');
    }
  }

  /**
   * Upload a buffer to Supabase Storage (for template migration)
   */
  async uploadBuffer(
    buffer: Buffer,
    filePath: string,
    contentType: string = 'image/jpeg',
  ): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    try {
      const { data, error } = await this.supabase.storage
        .from('smartwish-assets')
        .upload(filePath, buffer, {
          contentType,
          cacheControl: '86400', // 24 hours
          upsert: true,
        });

      if (error) {
        console.error('Error uploading buffer to Supabase Storage:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('smartwish-assets')
        .getPublicUrl(filePath);

      console.log(`✅ Buffer uploaded to cloud: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadBuffer:', error);
      throw new Error('Failed to upload buffer to cloud storage');
    }
  }

  /**
   * Get public URL for a file in storage
   */
  async getPublicUrl(filePath: string): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    const { data } = this.supabase.storage
      .from('smartwish-assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Upload multiple images and return their URLs
   */
  async uploadImages(
    images: string[],
    userId: string,
    designId: string,
  ): Promise<string[]> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    const uploadedUrls: string[] = [];
    const folder = `users/${userId}/designs/${designId}`;

    for (let i = 0; i < images.length; i++) {
      try {
        const filename = `page_${i + 1}.png`;
        const url = await this.uploadImage(images[i], filename, folder);
        uploadedUrls.push(url);
      } catch (error) {
        console.error(`Error uploading image ${i + 1}:`, error);
        throw error;
      }
    }

    return uploadedUrls;
  }

  /**
   * Delete images from cloud storage
   */
  async deleteImages(imageUrls: string[]): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    try {
      // Extract file paths from URLs
      const filePaths = imageUrls.map((url) => {
        const urlObj = new URL(url);
        return urlObj.pathname.replace(
          '/storage/v1/object/public/smartwish-assets/',
          '',
        );
      });

      // Delete files from storage
      const { error } = await this.supabase.storage
        .from('smartwish-assets')
        .remove(filePaths);

      if (error) {
        console.error('Error deleting from Supabase Storage:', error);
        return false;
      }

      console.log(`✅ Deleted ${filePaths.length} images from cloud storage`);
      return true;
    } catch (error) {
      console.error('Error in deleteImages:', error);
      return false;
    }
  }

  /**
   * Update images for a design - upload new images and optionally delete old ones
   */
  async updateImages(
    newImages: string[],
    userId: string,
    designId: string,
    oldImageUrls?: string[],
  ): Promise<string[]> {
    if (!this.supabase) {
      throw new Error('Supabase Storage not configured');
    }

    try {
      // Upload new images
      const newImageUrls = await this.uploadImages(newImages, userId, designId);

      // Optionally delete old images (but don't fail if deletion fails)
      if (oldImageUrls && oldImageUrls.length > 0) {
        try {
          await this.deleteImages(oldImageUrls);
          console.log(
            `✅ Cleaned up ${oldImageUrls.length} old images for design ${designId}`,
          );
        } catch (deleteError) {
          console.warn(
            `⚠️ Failed to delete old images for design ${designId}:`,
            deleteError,
          );
          // Don't throw error - new images are already uploaded
        }
      }

      return newImageUrls;
    } catch (error) {
      console.error('Error updating images:', error);
      throw error;
    }
  }

  /**
   * Check if Supabase Storage is configured
   */
  isConfigured(): boolean {
    return !!this.supabase;
  }
}
