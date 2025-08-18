import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export interface ImageVariants {
  webp: string;
  png: string;
  thumbnail: string;
  metadata: {
    width: number;
    height: number;
    size: number;
    format: string;
  };
}

export interface PublishedDesignUrls {
  pages: Array<{
    pageNumber: number;
    webp: string;
    png: string;
    thumbnail: string;
  }>;
  previews: {
    cover: string;
    grid: string;
    carousel: string;
  };
  metadata: {
    totalSize: number;
    processedAt: string;
    version: string;
  };
}

@Injectable()
export class EnhancedStorageService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Enhanced Storage not configured - missing Supabase credentials');
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log('✅ Enhanced Storage service initialized');
  }

  /**
   * Publish a design with proper storage organization and optimization
   */
  async publishDesign(
    designId: string,
    userId: string,
    images: string[],
    title: string
  ): Promise<PublishedDesignUrls> {
    if (!this.supabase) {
      throw new Error('Enhanced storage not configured');
    }

    try {
      console.log(`📤 Publishing design ${designId} with ${images.length} images`);

      const timestamp = Date.now();
      const basePath = `designs/${designId}`;
      
      // Process and upload all page images
      const pageUrls = await Promise.all(
        images.map((image, index) => 
          this.processAndUploadPageImage(image, basePath, index + 1, timestamp)
        )
      );

      // Generate and upload preview images
      const previews = await this.generateAndUploadPreviews(
        images, 
        basePath, 
        title, 
        timestamp
      );

      // Calculate total storage used
      const totalSize = pageUrls.reduce((sum, page) => sum + page.metadata.size, 0);

      // Store metadata
      await this.storeImageMetadata(designId, pageUrls, previews, totalSize);

      console.log(`✅ Successfully published design ${designId} (${this.formatBytes(totalSize)})`);

      return {
        pages: pageUrls.map(url => ({
          pageNumber: url.pageNumber,
          webp: url.webp,
          png: url.png,
          thumbnail: url.thumbnail
        })),
        previews,
        metadata: {
          totalSize,
          processedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      console.error(`❌ Failed to publish design ${designId}:`, error);
      throw new Error(`Publishing failed: ${error.message}`);
    }
  }

  /**
   * Process a single page image into multiple variants
   */
  private async processAndUploadPageImage(
    imageData: string,
    basePath: string,
    pageNumber: number,
    timestamp: number
  ): Promise<{
    pageNumber: number;
    webp: string;
    png: string;
    thumbnail: string;
    metadata: any;
  }> {
    try {
      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Process with Sharp for optimization
      const sharpImage = sharp(buffer);
      const metadata = await sharpImage.metadata();

      // Generate variants
      const variants = await Promise.all([
        // WebP version (high quality, smaller size)
        this.processImage(sharpImage, { format: 'webp', quality: 85 }),
        // PNG version (fallback)
        this.processImage(sharpImage, { format: 'png' }),
        // Thumbnail version
        this.processImage(sharpImage, { 
          format: 'webp', 
          quality: 75, 
          resize: { width: 200, height: 150, fit: 'cover' }
        })
      ]);

      // Upload all variants
      const uploadPromises = [
        this.uploadFile(variants[0], `${basePath}/pages`, `${timestamp}_page_${pageNumber}_main.webp`),
        this.uploadFile(variants[1], `${basePath}/pages`, `${timestamp}_page_${pageNumber}_main.png`),
        this.uploadFile(variants[2], `${basePath}/pages`, `${timestamp}_page_${pageNumber}_thumb.webp`)
      ];

      const [webpUrl, pngUrl, thumbnailUrl] = await Promise.all(uploadPromises);

      return {
        pageNumber,
        webp: webpUrl,
        png: pngUrl,
        thumbnail: thumbnailUrl,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          size: variants[0].length + variants[1].length + variants[2].length,
          format: metadata.format
        }
      };

    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error);
      throw new Error(`Failed to process page ${pageNumber}: ${error.message}`);
    }
  }

  /**
   * Generate preview images (cover, grid, carousel)
   */
  private async generateAndUploadPreviews(
    images: string[],
    basePath: string,
    title: string,
    timestamp: number
  ): Promise<{ cover: string; grid: string; carousel: string }> {
    try {
      // Use first image as cover
      const coverBuffer = await this.createCoverPreview(images[0], title);
      
      // Create 2x2 grid preview
      const gridBuffer = await this.createGridPreview(images);
      
      // Create horizontal carousel preview
      const carouselBuffer = await this.createCarouselPreview(images);

      // Upload previews
      const [coverUrl, gridUrl, carouselUrl] = await Promise.all([
        this.uploadFile(coverBuffer, `${basePath}/previews`, `${timestamp}_cover.webp`),
        this.uploadFile(gridBuffer, `${basePath}/previews`, `${timestamp}_grid.webp`),
        this.uploadFile(carouselBuffer, `${basePath}/previews`, `${timestamp}_carousel.webp`)
      ]);

      return {
        cover: coverUrl,
        grid: gridUrl,
        carousel: carouselUrl
      };

    } catch (error) {
      console.error('Error generating previews:', error);
      throw new Error(`Failed to generate previews: ${error.message}`);
    }
  }

  /**
   * Create cover preview with title overlay
   */
  private async createCoverPreview(imageData: string, title: string): Promise<Buffer> {
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create a cover image with title overlay
    const coverImage = await sharp(buffer)
      .resize(400, 300, { fit: 'cover' })
      .composite([
        {
          input: Buffer.from(`
            <svg width="400" height="60" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="60" fill="rgba(0,0,0,0.7)"/>
              <text x="200" y="35" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${title.substring(0, 40)}</text>
            </svg>
          `),
          top: 240,
          left: 0
        }
      ])
      .webp({ quality: 85 })
      .toBuffer();

    return coverImage;
  }

  /**
   * Create 2x2 grid preview
   */
  private async createGridPreview(images: string[]): Promise<Buffer> {
    const processedImages = await Promise.all(
      images.slice(0, 4).map(async (imageData) => {
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        return sharp(buffer).resize(200, 150, { fit: 'cover' }).toBuffer();
      })
    );

    // Create 2x2 grid
    const gridImage = sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    const composite = [
      { input: processedImages[0], top: 0, left: 0 },
      { input: processedImages[1] || processedImages[0], top: 0, left: 200 },
      { input: processedImages[2] || processedImages[0], top: 150, left: 0 },
      { input: processedImages[3] || processedImages[0], top: 150, left: 200 }
    ];

    return gridImage.composite(composite).webp({ quality: 85 }).toBuffer();
  }

  /**
   * Create horizontal carousel preview
   */
  private async createCarouselPreview(images: string[]): Promise<Buffer> {
    const processedImages = await Promise.all(
      images.map(async (imageData) => {
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        return sharp(buffer).resize(150, 112, { fit: 'cover' }).toBuffer();
      })
    );

    // Create horizontal carousel
    const carouselWidth = images.length * 150 + (images.length - 1) * 10; // 10px spacing
    const carouselImage = sharp({
      create: {
        width: Math.min(carouselWidth, 800), // Max width 800px
        height: 112,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    const composite = processedImages.map((img, index) => ({
      input: img,
      top: 0,
      left: index * 160 // 150px width + 10px spacing
    }));

    return carouselImage.composite(composite).webp({ quality: 85 }).toBuffer();
  }

  /**
   * Process image with Sharp
   */
  private async processImage(
    sharpImage: sharp.Sharp,
    options: {
      format: 'webp' | 'png' | 'jpeg';
      quality?: number;
      resize?: { width: number; height: number; fit?: keyof sharp.FitEnum };
    }
  ): Promise<Buffer> {
    let pipeline = sharpImage.clone();

    if (options.resize) {
      pipeline = pipeline.resize(options.resize.width, options.resize.height, {
        fit: options.resize.fit || 'inside',
        withoutEnlargement: true
      });
    }

    switch (options.format) {
      case 'webp':
        return pipeline.webp({ quality: options.quality || 85 }).toBuffer();
      case 'png':
        return pipeline.png({ compressionLevel: 9 }).toBuffer();
      case 'jpeg':
        return pipeline.jpeg({ quality: options.quality || 90 }).toBuffer();
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadFile(
    buffer: Buffer,
    folder: string,
    filename: string
  ): Promise<string> {
    const filePath = `${folder}/${filename}`;

    const publishedBucket = process.env.SW_PUBLISHED_BUCKET || 'smartwish-published';
    const { data, error } = await this.supabase.storage
      .from(publishedBucket)
      .upload(filePath, buffer, {
        contentType: this.getContentType(filename),
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });

    if (error) {
      console.error(`Error uploading ${filePath}:`, error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(publishedBucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  /**
   * Store image metadata in database
   */
  private async storeImageMetadata(
    designId: string,
    pageUrls: any[],
    previews: any,
    totalSize: number
  ): Promise<void> {
    try {
      // Store in sw_design_images table
      const imageRecords = [];

      // Add page images
      for (const page of pageUrls) {
        imageRecords.push(
          {
            design_id: designId,
            page_number: page.pageNumber,
            image_type: 'page',
            storage_path: this.extractPathFromUrl(page.webp),
            public_url: page.png, // Fallback URL
            cdn_url: page.webp, // Optimized URL
            webp_url: page.webp,
            thumbnail_url: page.thumbnail,
            file_size: page.metadata.size,
            dimensions: {
              width: page.metadata.width,
              height: page.metadata.height
            }
          },
          {
            design_id: designId,
            page_number: page.pageNumber,
            image_type: 'thumbnail',
            storage_path: this.extractPathFromUrl(page.thumbnail),
            public_url: page.thumbnail,
            cdn_url: page.thumbnail,
            webp_url: page.thumbnail,
            thumbnail_url: page.thumbnail,
            file_size: Math.round(page.metadata.size * 0.1), // Estimate
            dimensions: { width: 200, height: 150 }
          }
        );
      }

      // Add preview images
      const previewTypes = ['cover', 'grid', 'carousel'];
      previewTypes.forEach((type, index) => {
        imageRecords.push({
          design_id: designId,
          page_number: 0,
          image_type: type,
          storage_path: this.extractPathFromUrl(previews[type]),
          public_url: previews[type],
          cdn_url: previews[type],
          webp_url: previews[type],
          thumbnail_url: previews[type],
          file_size: Math.round(totalSize * 0.05), // Estimate
          dimensions: type === 'cover' ? { width: 400, height: 300 } : 
                     type === 'grid' ? { width: 400, height: 300 } :
                     { width: 800, height: 112 }
        });
      });

      // Insert all records
      const { error } = await this.supabase
        .from('sw_design_images')
        .insert(imageRecords);

      if (error) {
        console.error('Error storing image metadata:', error);
        throw new Error(`Failed to store metadata: ${error.message}`);
      }

      console.log(`✅ Stored metadata for ${imageRecords.length} images`);

    } catch (error) {
      console.error('Error in storeImageMetadata:', error);
      throw error;
    }
  }

  /**
   * Get content type from filename
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'webp': return 'image/webp';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      default: return 'image/png';
    }
  }

  /**
   * Extract storage path from public URL
   */
  private extractPathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Expect pattern: /storage/v1/object/public/<bucket>/<path>
      const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.*)$/);
      if (match && match[2]) {
        return match[2];
      }
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  /**
   * Format bytes for logging
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Delete design images from storage
   */
  async deleteDesignImages(designId: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Enhanced storage not configured');
    }

    try {
      // List all files for the design
      const publishedBucket = process.env.SW_PUBLISHED_BUCKET || 'smartwish-published';
      const { data: files, error: listError } = await this.supabase.storage
        .from(publishedBucket)
        .list(`designs/${designId}`);

      if (listError) {
        console.error('Error listing files for deletion:', listError);
        return false;
      }

      if (!files || files.length === 0) {
        console.log(`No files found for design ${designId}`);
        return true;
      }

      // Delete all files
      const filePaths = files.map(file => `designs/${designId}/${file.name}`);
      const { error: deleteError } = await this.supabase.storage
        .from(publishedBucket)
        .remove(filePaths);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        return false;
      }

      // Delete metadata from database
      const { error: dbError } = await this.supabase
        .from('sw_design_images')
        .delete()
        .eq('design_id', designId);

      if (dbError) {
        console.error('Error deleting image metadata:', dbError);
        return false;
      }

      console.log(`✅ Deleted all files and metadata for design ${designId}`);
      return true;

    } catch (error) {
      console.error('Error in deleteDesignImages:', error);
      return false;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.supabase;
  }
}
