import { Controller, Get, Param } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('api/simple-templates')
export class SimpleTemplatesController {
  constructor(
    @InjectDataSource() private dataSource: DataSource
  ) {}

  @Get()
  async getAllTemplates() {
    try {
      // Use raw SQL to get templates - we know this works from our earlier testing
      const templates = await this.dataSource.query(`
        SELECT 
          t.id, 
          t.slug, 
          t.title, 
          t.category_id, 
          t.author_id,
          t.description, 
          t.price, 
          t.language, 
          t.region, 
          t.status, 
          t.popularity, 
          t.num_downloads, 
          t.cover_image, 
          t.image_1,
          t.image_2,
          t.image_3,
          t.image_4,
          t.current_version, 
          t.published_at, 
          t.created_at, 
          t.updated_at,
          c.name as category_name,
          c.display_name as category_display_name,
          'SmartWish' as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        WHERE t.status = 'published'
        ORDER BY t.created_at DESC
      `);

      return {
        success: true,
        data: templates,
        total: templates.length,
      };
    } catch (error) {
      console.error('Templates error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }

  @Get('category/:categoryId')
  async getTemplatesByCategory(@Param('categoryId') categoryId: string) {
    try {
      // Use raw SQL to get templates by category
      const templates = await this.dataSource.query(`
        SELECT 
          t.id, 
          t.slug, 
          t.title, 
          t.category_id, 
          t.author_id,
          t.description, 
          t.price, 
          t.language, 
          t.region, 
          t.status, 
          t.popularity, 
          t.num_downloads, 
          t.cover_image, 
          t.image_1,
          t.image_2,
          t.image_3,
          t.image_4,
          t.current_version, 
          t.published_at, 
          t.created_at, 
          t.updated_at,
          c.name as category_name,
          c.display_name as category_display_name,
          'SmartWish' as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        WHERE t.status = 'published' AND t.category_id = $1
        ORDER BY t.created_at DESC
      `, [categoryId]);

      return {
        success: true,
        data: templates,
        total: templates.length,
      };
    } catch (error) {
      console.error('Templates by category error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }
}
