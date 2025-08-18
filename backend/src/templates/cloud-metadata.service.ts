import { Injectable } from '@nestjs/common';
import { SupabaseStorageService } from '../saved-designs/supabase-storage.service';

@Injectable()
export class CloudMetadataService {
  constructor(private storageService: SupabaseStorageService) {}

  /**
   * Get cloud metadata from Supabase storage
   */
  async getCloudMetadata(): Promise<any> {
    try {
      const url = await this.storageService.getPublicUrl(
        'templates/metadata/templates.json',
      );
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }

      const metadata = await response.json();
      console.log('✅ Cloud metadata loaded successfully');
      return metadata;
    } catch (error) {
      console.error('❌ Failed to load cloud metadata:', error);
      throw new Error('Cloud metadata unavailable');
    }
  }

  /**
   * Get cloud templates
   */
  async getCloudTemplates(): Promise<any[]> {
    try {
      const metadata = await this.getCloudMetadata();
      return metadata.templates || [];
    } catch (error) {
      console.error('❌ Failed to load cloud templates:', error);
      throw error;
    }
  }

  /**
   * Get cloud categories
   */
  async getCloudCategories(): Promise<any[]> {
    try {
      const metadata = await this.getCloudMetadata();
      return metadata.categories || [];
    } catch (error) {
      console.error('❌ Failed to load cloud categories:', error);
      throw error;
    }
  }

  /**
   * Get cloud themes
   */
  async getCloudThemes(): Promise<any[]> {
    try {
      const metadata = await this.getCloudMetadata();
      return metadata.themes || [];
    } catch (error) {
      console.error('❌ Failed to load cloud themes:', error);
      throw error;
    }
  }

  /**
   * Get cloud marketplace items
   */
  async getCloudMarketplace(): Promise<any[]> {
    try {
      const metadata = await this.getCloudMetadata();
      return metadata.marketplace || [];
    } catch (error) {
      console.error('❌ Failed to load cloud marketplace:', error);
      throw error;
    }
  }

  /**
   * Get template by ID from cloud
   */
  async getCloudTemplateById(templateId: string): Promise<any | null> {
    try {
      const templates = await this.getCloudTemplates();
      return templates.find((template) => template.id === templateId) || null;
    } catch (error) {
      console.error(`❌ Failed to load cloud template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Get category by ID from cloud
   */
  async getCloudCategoryById(categoryId: string): Promise<any | null> {
    try {
      const categories = await this.getCloudCategories();
      return categories.find((category) => category.id === categoryId) || null;
    } catch (error) {
      console.error(`❌ Failed to load cloud category ${categoryId}:`, error);
      return null;
    }
  }

  /**
   * Search templates in cloud
   */
  async searchCloudTemplates(searchTerm: string): Promise<any[]> {
    try {
      const templates = await this.getCloudTemplates();
      const lowerSearchTerm = searchTerm.toLowerCase();

      return templates.filter((template) => {
        const title = template.title?.toLowerCase() || '';
        const description = template.description?.toLowerCase() || '';
        const keywords = template.searchKeywords?.join(' ').toLowerCase() || '';

        return (
          title.includes(lowerSearchTerm) ||
          description.includes(lowerSearchTerm) ||
          keywords.includes(lowerSearchTerm)
        );
      });
    } catch (error) {
      console.error('❌ Failed to search cloud templates:', error);
      return [];
    }
  }

  /**
   * Get templates by category from cloud
   */
  async getCloudTemplatesByCategory(categoryId: string): Promise<any[]> {
    try {
      const templates = await this.getCloudTemplates();
      return templates.filter((template) => template.category === categoryId);
    } catch (error) {
      console.error(
        `❌ Failed to load cloud templates for category ${categoryId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Check if cloud metadata is available
   */
  async isCloudMetadataAvailable(): Promise<boolean> {
    try {
      await this.getCloudMetadata();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get metadata version and last updated info
   */
  async getMetadataInfo(): Promise<{
    version: string;
    lastUpdated: string;
    migrationInfo: any;
  } | null> {
    try {
      const metadata = await this.getCloudMetadata();
      return {
        version: metadata.version,
        lastUpdated: metadata.lastUpdated,
        migrationInfo: metadata.migrationInfo,
      };
    } catch (error) {
      console.error('❌ Failed to get metadata info:', error);
      return null;
    }
  }

  /**
   * Validate cloud metadata structure
   */
  async validateCloudMetadata(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      const metadata = await this.getCloudMetadata();
      const errors: string[] = [];

      // Check required fields
      if (!metadata.version) errors.push('Missing version field');
      if (!metadata.lastUpdated) errors.push('Missing lastUpdated field');
      if (!metadata.templates) errors.push('Missing templates field');
      if (!metadata.categories) errors.push('Missing categories field');
      if (!metadata.themes) errors.push('Missing themes field');
      if (!metadata.marketplace) errors.push('Missing marketplace field');

      // Check templates structure
      if (metadata.templates && Array.isArray(metadata.templates)) {
        metadata.templates.forEach((template: any, index: number) => {
          if (!template.id) errors.push(`Template ${index} missing id`);
          if (!template.title) errors.push(`Template ${index} missing title`);
          if (!template.pages || !Array.isArray(template.pages)) {
            errors.push(`Template ${index} missing or invalid pages`);
          }
        });
      }

      // Check categories structure
      if (metadata.categories && Array.isArray(metadata.categories)) {
        metadata.categories.forEach((category: any, index: number) => {
          if (!category.id) errors.push(`Category ${index} missing id`);
          if (!category.name) errors.push(`Category ${index} missing name`);
          if (!category.coverImage)
            errors.push(`Category ${index} missing coverImage`);
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to validate metadata: ${error.message}`],
      };
    }
  }
}
