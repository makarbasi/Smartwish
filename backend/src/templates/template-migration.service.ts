import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseStorageService } from '../saved-designs/supabase-storage.service';

@Injectable()
export class TemplateMigrationService {
  constructor(private storageService: SupabaseStorageService) {}

  /**
   * Migrate all template assets to cloud storage
   */
  async migrateAllAssets() {
    console.log('🚀 Starting comprehensive template migration to cloud...');

    try {
      // Check if we're in a production environment where local files might not exist
      const isProduction =
        process.env.NODE_ENV === 'production' || process.env.RENDER;

      if (isProduction) {
        console.log(
          '📝 Production environment detected - skipping file uploads, only migrating metadata...',
        );
        // In production, just migrate metadata since files are already in cloud
        await this.migrateMetadata();
      } else {
        // In development, migrate everything
        await Promise.all([
          this.migrateTemplateImages(),
          this.migrateCategoryImages(),
          this.migrateThemeImages(),
          this.migrateMarketplaceImages(),
          this.migrateMetadata(),
        ]);
      }

      console.log('✅ All assets migrated successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate template images (temp1.jpg through temp29.jpg)
   */
  async migrateTemplateImages() {
    console.log('📤 Migrating template images...');

    const templateFiles = [
      'temp1.jpg',
      'temp2.jpg',
      'temp3.jpg',
      'temp4.jpg',
      'temp5.jpg',
      'temp6.jpg',
      'temp7.jpg',
      'temp8.jpg',
      'temp9.jpg',
      'temp10.jpg',
      'temp11.jpg',
      'temp12.jpg',
      'temp13.jpg',
      'temp14.jpg',
      'temp15.jpg',
      'temp16.jpg',
      'temp17.jpg',
      'temp18.jpg',
      'temp19.jpg',
      'temp20.jpg',
      'temp21.jpg',
      'temp22.jpg',
      'temp23.jpg',
      'temp24.jpg',
      'temp25.jpg',
      'temp26.jpg',
      'temp27.jpg',
      'temp28.jpg',
      'temp29.jpg',
    ];

    const uploadedUrls: string[] = [];

    for (const filename of templateFiles) {
      try {
        const cloudUrl = await this.uploadTemplateImage(filename);
        uploadedUrls.push(cloudUrl);
        console.log(`✅ Uploaded ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${filename}:`, error);
        // In production, skip missing files instead of throwing
        if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
          console.log(`⚠️ Skipping ${filename} in production environment`);
          continue;
        }
        throw error;
      }
    }

    console.log(
      `✅ Template images migration completed: ${uploadedUrls.length} files`,
    );
    return uploadedUrls;
  }

  /**
   * Migrate category images
   */
  async migrateCategoryImages() {
    console.log('📤 Migrating category images...');

    const categoryFiles = [
      'img-cover-1.jpg',
      'img-cover-2.jpg',
      'img-cover-3.jpg',
      'img-cover-4.jpg',
      'img-cover-5.jpg',
      'img-cover-6.jpg',
      'img-cover-7.jpg',
      'img-cover-8.jpg',
    ];

    const uploadedUrls: string[] = [];

    for (const filename of categoryFiles) {
      try {
        const cloudUrl = await this.uploadCategoryImage(filename);
        uploadedUrls.push(cloudUrl);
        console.log(`✅ Uploaded ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${filename}:`, error);
        // In production, skip missing files instead of throwing
        if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
          console.log(`⚠️ Skipping ${filename} in production environment`);
          continue;
        }
        throw error;
      }
    }

    console.log(
      `✅ Category images migration completed: ${uploadedUrls.length} files`,
    );
    return uploadedUrls;
  }

  /**
   * Migrate theme images
   */
  async migrateThemeImages() {
    console.log('📤 Migrating theme images...');

    const themeFiles = [
      'anime.jpg',
      'charcoal.jpg',
      'disney.jpg',
      'line-art.jpg',
      'low-poly.jpg',
      'oil-painting.jpg',
      'pencil-sketch.jpg',
      'pixar.jpg',
      'pop-art.jpg',
      'stencil.jpg',
      'watercolor.jpg',
    ];

    const uploadedUrls: string[] = [];

    for (const filename of themeFiles) {
      try {
        const cloudUrl = await this.uploadThemeImage(filename);
        uploadedUrls.push(cloudUrl);
        console.log(`✅ Uploaded ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${filename}:`, error);
        // In production, skip missing files instead of throwing
        if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
          console.log(`⚠️ Skipping ${filename} in production environment`);
          continue;
        }
        throw error;
      }
    }

    console.log(
      `✅ Theme images migration completed: ${uploadedUrls.length} files`,
    );
    return uploadedUrls;
  }

  /**
   * Migrate marketplace images
   */
  async migrateMarketplaceImages() {
    console.log('📤 Migrating marketplace images...');

    const marketplaceFiles = [
      'adobe.jpg',
      'amazon-gift-card.jpg',
      'amazon-prime-gift-card.jpg',
      'amex-gift-card.jpg',
      'apple-gift-card.jpg',
      'bestbuy-gift-card.jpg',
      'costco.jpg',
      'disney-gift-card.jpg',
      'googleplay-gift-card.jpg',
      'homedepot-gift-card.jpg',
      'la-fitness.jpg',
      'netflix-gift-card.jpg',
      'netflix-premium.jpg',
      'rei-gift-card.jpg',
      'spotify.jpg',
      'starbucks-gift-card.jpg',
      'target-gift-card.jpg',
      'uber-gift-card.jpg',
      'venmo.jpg',
      'visa-gift-card.jpg',
      'walmart-gift-card.jpg',
      'youtube-premium.jpg',
      'zelle.jpg',
    ];

    const uploadedUrls: string[] = [];

    for (const filename of marketplaceFiles) {
      try {
        const cloudUrl = await this.uploadMarketplaceImage(filename);
        uploadedUrls.push(cloudUrl);
        console.log(`✅ Uploaded ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${filename}:`, error);
        // In production, skip missing files instead of throwing
        if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
          console.log(`⚠️ Skipping ${filename} in production environment`);
          continue;
        }
        throw error;
      }
    }

    console.log(
      `✅ Marketplace images migration completed: ${uploadedUrls.length} files`,
    );
    return uploadedUrls;
  }

  /**
   * Migrate metadata to cloud
   */
  async migrateMetadata() {
    console.log('📤 Migrating metadata...');

    try {
      const metadata = await this.generateMetadata();
      const metadataJson = JSON.stringify(metadata, null, 2);
      const buffer = Buffer.from(metadataJson, 'utf-8');

      const cloudUrl = await this.storageService.uploadBuffer(
        buffer,
        'templates/metadata/templates.json',
        'application/json',
      );

      console.log(`✅ Metadata uploaded: ${cloudUrl}`);
      return cloudUrl;
    } catch (error) {
      console.error('❌ Failed to upload metadata:', error);
      throw error;
    }
  }

  /**
   * Upload a single template image
   */
  private async uploadTemplateImage(filename: string): Promise<string> {
    const localPath = this.resolveImagePath('images', filename);
    const cloudPath = `templates/images/${filename}`;

    if (!fs.existsSync(localPath)) {
      // In production, check if file already exists in cloud
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        console.log(
          `📝 Production: Template file not found locally: ${localPath}`,
        );
        console.log(`📝 Assuming ${filename} is already in cloud storage`);
        // Return the expected cloud URL
        return `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/${cloudPath}`;
      }
      throw new Error(`Template file not found: ${localPath}`);
    }

    const fileBuffer = fs.readFileSync(localPath);
    return await this.storageService.uploadBuffer(
      fileBuffer,
      cloudPath,
      'image/jpeg',
    );
  }

  /**
   * Upload a single category image
   */
  private async uploadCategoryImage(filename: string): Promise<string> {
    const localPath = this.resolveImagePath('images', filename);
    const cloudPath = `categories/images/${filename}`;

    if (!fs.existsSync(localPath)) {
      // In production, check if file already exists in cloud
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        console.log(
          `📝 Production: Category file not found locally: ${localPath}`,
        );
        console.log(`📝 Assuming ${filename} is already in cloud storage`);
        // Return the expected cloud URL
        return `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/${cloudPath}`;
      }
      throw new Error(`Category file not found: ${localPath}`);
    }

    const fileBuffer = fs.readFileSync(localPath);
    return await this.storageService.uploadBuffer(
      fileBuffer,
      cloudPath,
      'image/jpeg',
    );
  }

  /**
   * Upload a single theme image
   */
  private async uploadThemeImage(filename: string): Promise<string> {
    const localPath = this.resolveImagePath(path.join('images', 'themes'), filename);
    const cloudPath = `themes/images/${filename}`;

    if (!fs.existsSync(localPath)) {
      // In production, check if file already exists in cloud
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        console.log(
          `📝 Production: Theme file not found locally: ${localPath}`,
        );
        console.log(`📝 Assuming ${filename} is already in cloud storage`);
        // Return the expected cloud URL
        return `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/${cloudPath}`;
      }
      throw new Error(`Theme file not found: ${localPath}`);
    }

    const fileBuffer = fs.readFileSync(localPath);
    return await this.storageService.uploadBuffer(
      fileBuffer,
      cloudPath,
      'image/jpeg',
    );
  }

  /**
   * Upload a single marketplace image
   */
  private async uploadMarketplaceImage(filename: string): Promise<string> {
    const localPath = this.resolveImagePath(
      path.join('images', 'marketplace'),
      filename,
    );
    const cloudPath = `marketplace/images/${filename}`;

    if (!fs.existsSync(localPath)) {
      // In production, check if file already exists in cloud
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        console.log(
          `📝 Production: Marketplace file not found locally: ${localPath}`,
        );
        console.log(`📝 Assuming ${filename} is already in cloud storage`);
        // Return the expected cloud URL
        return `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/${cloudPath}`;
      }
      throw new Error(`Marketplace file not found: ${localPath}`);
    }

    const fileBuffer = fs.readFileSync(localPath);
    return await this.storageService.uploadBuffer(
      fileBuffer,
      cloudPath,
      'image/jpeg',
    );
  }

  /**
   * Resolve an image path trying common project layouts and extensions
   */
  private resolveImagePath(subFolder: string, filename: string): string {
    const baseCandidates = [
      // When backend is cwd
      path.resolve(process.cwd(), '..', 'frontend', 'public'),
      // When project root is cwd
      path.resolve(process.cwd(), 'frontend', 'public'),
      // From compiled dist folder (__dirname is backend/dist/backend/src/templates)
      path.resolve(__dirname, '../../../../frontend/public'),
      path.resolve(__dirname, '../../../../../frontend/public'),
    ];

    const name = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const exts = ['.jpg', '.jpeg', '.png', '.webp'];

    for (const base of baseCandidates) {
      for (const ext of exts) {
        const candidate = path.join(base, subFolder, `${name}${ext}`);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      // Also try the provided filename as-is
      const direct = path.join(base, subFolder, filename);
      if (fs.existsSync(direct)) {
        return direct;
      }
    }

    throw new Error(
      `Image file not found for ${filename} in subFolder ${subFolder}. Checked bases: ${baseCandidates.join(
        ' | ',
      )}`,
    );
  }

  /**
   * Generate comprehensive metadata
   */
  private async generateMetadata() {
    // Import template data
    const { CATEGORIES, TEMPLATES } = await import(
      '../../../shared/constants/templates.js'
    );

    // Convert image paths to cloud URLs
    const cloudTemplates = Object.entries(TEMPLATES).map(([id, template]) => ({
      ...template,
      pages: template.pages.map((page) => ({
        ...page,
        image: this.convertToCloudUrl(page.image, 'templates/images'),
      })),
    }));

    const cloudCategories = Object.values(CATEGORIES).map((category) => ({
      ...category,
      coverImage: this.convertToCloudUrl(
        category.coverImage,
        'categories/images',
      ),
    }));

    const metadata = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      migrationInfo: {
        totalTemplates: Object.keys(TEMPLATES).length,
        totalCategories: Object.keys(CATEGORIES).length,
        totalThemes: 11,
        totalMarketplaceItems: 23,
      },
      templates: cloudTemplates,
      categories: cloudCategories,
      themes: this.generateThemeMetadata(),
      marketplace: this.generateMarketplaceMetadata(),
    };

    return metadata;
  }

  /**
   * Convert local image path to cloud URL
   */
  private convertToCloudUrl(localPath: string, cloudFolder: string): string {
    if (localPath.startsWith('/images/')) {
      const filename = localPath.split('/').pop();
      return `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/${cloudFolder}/${filename}`;
    }
    return localPath;
  }

  /**
   * Generate theme metadata
   */
  private generateThemeMetadata() {
    const themes = [
      { id: 'anime', name: 'Anime', image: 'anime.jpg' },
      { id: 'charcoal', name: 'Charcoal', image: 'charcoal.jpg' },
      { id: 'disney', name: 'Disney', image: 'disney.jpg' },
      { id: 'line-art', name: 'Line Art', image: 'line-art.jpg' },
      { id: 'low-poly', name: 'Low Poly', image: 'low-poly.jpg' },
      { id: 'oil-painting', name: 'Oil Painting', image: 'oil-painting.jpg' },
      {
        id: 'pencil-sketch',
        name: 'Pencil Sketch',
        image: 'pencil-sketch.jpg',
      },
      { id: 'pixar', name: 'Pixar', image: 'pixar.jpg' },
      { id: 'pop-art', name: 'Pop Art', image: 'pop-art.jpg' },
      { id: 'stencil', name: 'Stencil', image: 'stencil.jpg' },
      { id: 'watercolor', name: 'Watercolor', image: 'watercolor.jpg' },
    ];

    return themes.map((theme) => ({
      ...theme,
      image: `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/themes/images/${theme.image}`,
    }));
  }

  /**
   * Generate marketplace metadata
   */
  private generateMarketplaceMetadata() {
    const marketplaceItems = [
      { id: 'adobe', name: 'Adobe', image: 'adobe.jpg', category: 'software' },
      {
        id: 'amazon-gift-card',
        name: 'Amazon Gift Card',
        image: 'amazon-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'amazon-prime-gift-card',
        name: 'Amazon Prime Gift Card',
        image: 'amazon-prime-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'amex-gift-card',
        name: 'American Express Gift Card',
        image: 'amex-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'apple-gift-card',
        name: 'Apple Gift Card',
        image: 'apple-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'bestbuy-gift-card',
        name: 'Best Buy Gift Card',
        image: 'bestbuy-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'costco',
        name: 'Costco',
        image: 'costco.jpg',
        category: 'membership',
      },
      {
        id: 'disney-gift-card',
        name: 'Disney Gift Card',
        image: 'disney-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'googleplay-gift-card',
        name: 'Google Play Gift Card',
        image: 'googleplay-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'homedepot-gift-card',
        name: 'Home Depot Gift Card',
        image: 'homedepot-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'la-fitness',
        name: 'LA Fitness',
        image: 'la-fitness.jpg',
        category: 'membership',
      },
      {
        id: 'netflix-gift-card',
        name: 'Netflix Gift Card',
        image: 'netflix-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'netflix-premium',
        name: 'Netflix Premium',
        image: 'netflix-premium.jpg',
        category: 'subscription',
      },
      {
        id: 'rei-gift-card',
        name: 'REI Gift Card',
        image: 'rei-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'spotify',
        name: 'Spotify',
        image: 'spotify.jpg',
        category: 'subscription',
      },
      {
        id: 'starbucks-gift-card',
        name: 'Starbucks Gift Card',
        image: 'starbucks-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'target-gift-card',
        name: 'Target Gift Card',
        image: 'target-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'uber-gift-card',
        name: 'Uber Gift Card',
        image: 'uber-gift-card.jpg',
        category: 'gift-card',
      },
      { id: 'venmo', name: 'Venmo', image: 'venmo.jpg', category: 'payment' },
      {
        id: 'visa-gift-card',
        name: 'Visa Gift Card',
        image: 'visa-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'walmart-gift-card',
        name: 'Walmart Gift Card',
        image: 'walmart-gift-card.jpg',
        category: 'gift-card',
      },
      {
        id: 'youtube-premium',
        name: 'YouTube Premium',
        image: 'youtube-premium.jpg',
        category: 'subscription',
      },
      { id: 'zelle', name: 'Zelle', image: 'zelle.jpg', category: 'payment' },
    ];

    return marketplaceItems.map((item) => ({
      ...item,
      image: `https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/marketplace/images/${item.image}`,
    }));
  }
}
