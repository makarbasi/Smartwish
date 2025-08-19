import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseTemplatesEnhancedService, Template, Category, SearchResult } from './supabase-templates-enhanced.service';

@Controller('templates-enhanced')
export class TemplatesEnhancedController {
  constructor(private readonly templatesEnhancedService: SupabaseTemplatesEnhancedService) {}

  // Category endpoints
  @Get('categories')
  async getAllCategories() {
    try {
      const categories = await this.templatesEnhancedService.getAllCategories();
      return {
        success: true,
        data: categories,
        count: categories.length
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new HttpException('Failed to fetch categories', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('categories/:id')
  async getCategoryById(@Param('id') id: string) {
    try {
      const category = await this.templatesEnhancedService.getCategoryById(id);
      if (!category) {
        throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching category:', error);
      throw new HttpException('Failed to fetch category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('categories')
  async createCategory(@Body() categoryData: Omit<Category, 'created_at' | 'updated_at'>) {
    try {
      const category = await this.templatesEnhancedService.createCategory(categoryData);
      if (!category) {
        throw new HttpException('Failed to create category', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error creating category:', error);
      throw new HttpException('Failed to create category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() updates: Partial<Category>) {
    try {
      const category = await this.templatesEnhancedService.updateCategory(id, updates);
      if (!category) {
        throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error updating category:', error);
      throw new HttpException('Failed to update category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    try {
      const success = await this.templatesEnhancedService.deleteCategory(id);
      if (!success) {
        throw new HttpException('Failed to delete category', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        message: 'Category deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error deleting category:', error);
      throw new HttpException('Failed to delete category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Template endpoints
  @Get('templates')
  async getAllTemplates() {
    try {
      const templates = await this.templatesEnhancedService.getAllTemplates();
      return {
        success: true,
        data: templates,
        count: templates.length
      };
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw new HttpException('Failed to fetch templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    try {
      const template = await this.templatesEnhancedService.getTemplateById(id);
      if (!template) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching template:', error);
      throw new HttpException('Failed to fetch template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/category/:categoryId')
  async getTemplatesByCategory(@Param('categoryId') categoryId: string) {
    try {
      const templates = await this.templatesEnhancedService.getTemplatesByCategory(categoryId);
      return {
        success: true,
        data: templates,
        count: templates.length
      };
    } catch (error) {
      console.error('Error fetching templates by category:', error);
      throw new HttpException('Failed to fetch templates by category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id/full')
  async getTemplateWithPages(@Param('id') id: string) {
    try {
      const result = await this.templatesEnhancedService.getTemplateWithPages(id);
      if (!result) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching template with pages:', error);
      throw new HttpException('Failed to fetch template with pages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('templates')
  async createTemplate(@Body() templateData: Omit<Template, 'created_at' | 'updated_at'>) {
    try {
      const template = await this.templatesEnhancedService.createTemplate(templateData);
      if (!template) {
        throw new HttpException('Failed to create template', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error creating template:', error);
      throw new HttpException('Failed to create template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() updates: Partial<Template>) {
    try {
      const template = await this.templatesEnhancedService.updateTemplate(id, updates);
      if (!template) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error updating template:', error);
      throw new HttpException('Failed to update template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    try {
      const success = await this.templatesEnhancedService.deleteTemplate(id);
      if (!success) {
        throw new HttpException('Failed to delete template', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        message: 'Template deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error deleting template:', error);
      throw new HttpException('Failed to delete template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Search endpoint
  @Post('search')
  async searchTemplates(
    @Body() searchData: {
      query: string;
      categoryId?: string;
      tags?: string[];
      priceRange?: { min: number; max: number };
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      if (!searchData.query) {
        throw new HttpException('Search query is required', HttpStatus.BAD_REQUEST);
      }

      const results = await this.templatesEnhancedService.searchTemplates(
        searchData.query,
        {
          categoryId: searchData.categoryId,
          tags: searchData.tags,
          priceRange: searchData.priceRange,
          limit: searchData.limit || 50,
          offset: searchData.offset || 0
        }
      );

      return {
        success: true,
        data: results,
        count: results.length,
        query: searchData.query
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error searching templates:', error);
      throw new HttpException('Failed to search templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Tags endpoints
  @Get('tags')
  async getAllTags() {
    try {
      const tags = await this.templatesEnhancedService.getAllTags();
      return {
        success: true,
        data: tags,
        count: tags.length
      };
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw new HttpException('Failed to fetch tags', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id/tags')
  async getTemplateTags(@Param('id') templateId: string) {
    try {
      const tags = await this.templatesEnhancedService.getTemplateTags(templateId);
      return {
        success: true,
        data: tags,
        count: tags.length
      };
    } catch (error) {
      console.error('Error fetching template tags:', error);
      throw new HttpException('Failed to fetch template tags', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Keywords endpoints
  @Get('templates/:id/keywords')
  async getTemplateKeywords(@Param('id') templateId: string) {
    try {
      const keywords = await this.templatesEnhancedService.getTemplateKeywords(templateId);
      return {
        success: true,
        data: keywords,
        count: keywords.length
      };
    } catch (error) {
      console.error('Error fetching template keywords:', error);
      throw new HttpException('Failed to fetch template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('templates/:id/keywords')
  async addTemplateKeywords(
    @Param('id') templateId: string,
    @Body() data: { keywords: string[] }
  ) {
    try {
      if (!data.keywords || !Array.isArray(data.keywords)) {
        throw new HttpException('Keywords array is required', HttpStatus.BAD_REQUEST);
      }

      const success = await this.templatesEnhancedService.addTemplateKeywords(templateId, data.keywords);
      if (!success) {
        throw new HttpException('Failed to add template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Keywords added successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error adding template keywords:', error);
      throw new HttpException('Failed to add template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Statistics endpoint
  @Get('stats')
  async getStats() {
    try {
      const [templatesCount, categoriesCount] = await Promise.all([
        this.templatesEnhancedService.getTemplatesCount(),
        this.templatesEnhancedService.getCategoriesCount()
      ]);

      return {
        success: true,
        data: {
          templates: templatesCount,
          categories: categoriesCount
        }
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw new HttpException('Failed to fetch statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
