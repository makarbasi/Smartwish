import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('api/simple-categories')
export class SimpleCategoriesController {
  constructor(
    @InjectDataSource() private dataSource: DataSource
  ) {}

  @Get()
  async getAllCategories() {
    try {
      // Use raw SQL to get categories with dynamic template counts
      const categories = await this.dataSource.query(`
        SELECT 
          c.id, 
          c.slug, 
          c.name, 
          c.display_name, 
          c.description, 
          c.cover_image, 
          c.sort_order, 
          c.is_active, 
          c.created_at, 
          c.updated_at,
          COALESCE(t.template_count, 0) as template_count
        FROM sw_categories c
        LEFT JOIN (
          SELECT 
            category_id, 
            COUNT(*) as template_count 
          FROM sw_templates 
          WHERE status = 'published' 
          GROUP BY category_id
        ) t ON c.id = t.category_id
        WHERE c.is_active = true 
        ORDER BY c.sort_order ASC, c.name ASC
      `);

      return {
        success: true,
        data: categories,
        total: categories.length,
      };
    } catch (error) {
      console.error('Categories error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }
}
