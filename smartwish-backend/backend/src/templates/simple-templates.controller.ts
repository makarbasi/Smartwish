import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('api/simple-templates')
export class SimpleTemplatesController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

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
          COALESCE(u.name, 'SmartWish') as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.author_id = u.id
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

  @Get('no-author')
  async getTemplatesWithoutAuthor() {
    try {
      // Get templates where author_id is NULL (anonymous templates)
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
        WHERE t.status = 'published' AND t.author_id IS NULL
        ORDER BY t.created_at DESC
      `);

      return {
        success: true,
        data: templates,
        total: templates.length,
        message: 'Templates without author (anonymous)',
      };
    } catch (error) {
      console.error('Templates without author error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }

  @Get('no-author/category/:categoryId')
  async getTemplatesWithoutAuthorByCategory(@Param('categoryId') categoryId: string) {
    try {
      // Get templates where author_id is NULL (anonymous templates) filtered by category
      const templates = await this.dataSource.query(
        `
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
        WHERE t.status = 'published' AND t.author_id IS NULL AND t.category_id = $1
        ORDER BY t.created_at DESC
      `,
        [categoryId],
      );

      return {
        success: true,
        data: templates,
        total: templates.length,
        message: `Templates without author (anonymous) in category`,
      };
    } catch (error) {
      console.error('Templates without author by category error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }

  @Get('with-author')
  async getTemplatesWithAuthor() {
    try {
      // Get templates where author_id is NOT NULL (authored templates)
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
          COALESCE(u.name, 'Unknown Author') as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.status = 'published' AND t.author_id IS NOT NULL
        ORDER BY t.created_at DESC
      `);

      return {
        success: true,
        data: templates,
        total: templates.length,
        message: 'Templates with author',
      };
    } catch (error) {
      console.error('Templates with author error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }

  @Get('with-author/category/:categoryId')
  async getTemplatesWithAuthorByCategory(@Param('categoryId') categoryId: string) {
    try {
      // Get templates where author_id is NOT NULL (authored templates) filtered by category
      const templates = await this.dataSource.query(
        `
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
          COALESCE(u.name, 'Unknown Author') as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.status = 'published' AND t.author_id IS NOT NULL AND t.category_id = $1
        ORDER BY t.created_at DESC
      `,
        [categoryId],
      );

      return {
        success: true,
        data: templates,
        total: templates.length,
        message: `Templates with author in category`,
      };
    } catch (error) {
      console.error('Templates with author by category error:', error);
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
      const templates = await this.dataSource.query(
        `
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
          COALESCE(u.name, 'SmartWish') as author
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.status = 'published' AND t.category_id = $1
        ORDER BY t.created_at DESC
      `,
        [categoryId],
      );

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

  @Put(':id')
  async updateTemplate(
    @Param('id') templateId: string,
    @Body()
    updateData: {
      title?: string;
      image_1?: string;
      image_2?: string;
      image_3?: string;
      image_4?: string;
      description?: string;
    },
  ) {
    try {
      console.log('Updating template:', templateId, 'with data:', updateData);

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updateData.title) {
        updateFields.push(`title = $${paramIndex}`);
        values.push(updateData.title);
        paramIndex++;
      }

      if (updateData.image_1) {
        updateFields.push(`image_1 = $${paramIndex}`);
        values.push(updateData.image_1);
        paramIndex++;
      }

      if (updateData.image_2) {
        updateFields.push(`image_2 = $${paramIndex}`);
        values.push(updateData.image_2);
        paramIndex++;
      }

      if (updateData.image_3) {
        updateFields.push(`image_3 = $${paramIndex}`);
        values.push(updateData.image_3);
        paramIndex++;
      }

      if (updateData.image_4) {
        updateFields.push(`image_4 = $${paramIndex}`);
        values.push(updateData.image_4);
        paramIndex++;
      }

      if (updateData.description) {
        updateFields.push(`description = $${paramIndex}`);
        values.push(updateData.description);
        paramIndex++;
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length === 1) {
        // Only updated_at
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      // Add template ID as the last parameter
      values.push(templateId);
      const whereClause = `id = $${paramIndex}`;

      const updateQuery = `
        UPDATE sw_templates 
        SET ${updateFields.join(', ')}
        WHERE ${whereClause}
        RETURNING *
      `;

      console.log('Update query:', updateQuery);
      console.log('Values:', values);

      const result = await this.dataSource.query(updateQuery, values);

      if (result.length === 0) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return {
        success: true,
        data: result[0],
        message: 'Template updated successfully',
      };
    } catch (error) {
      console.error('Update template error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }

  @Post('duplicate/:id')
  async duplicateTemplate(
    @Param('id') templateId: string,
    @Body()
    duplicateData: {
      title: string;
      image_1?: string;
      image_2?: string;
      image_3?: string;
      image_4?: string;
      user_id?: string;
    },
  ) {
    try {
      console.log(
        'Duplicating template:',
        templateId,
        'with data:',
        duplicateData,
      );

      // First, get the original template
      const original = await this.dataSource.query(
        `
        SELECT * FROM sw_templates WHERE id = $1
      `,
        [templateId],
      );

      if (original.length === 0) {
        return {
          success: false,
          error: 'Original template not found',
        };
      }

      const originalTemplate = original[0];

      // Create the duplicate with new images if provided
      const insertQuery = `
        INSERT INTO sw_templates (
          slug, title, category_id, author_id, description, price, 
          language, region, status, popularity, num_downloads,
          image_1, image_2, image_3, image_4, cover_image, current_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;

      const newSlug = `${originalTemplate.slug}-copy-${Date.now()}`;
      const values = [
        newSlug,
        duplicateData.title,
        originalTemplate.category_id,
        originalTemplate.author_id,
        originalTemplate.description,
        originalTemplate.price,
        originalTemplate.language,
        originalTemplate.region,
        'draft', // New copies start as drafts
        0, // Reset popularity
        0, // Reset downloads
        duplicateData.image_1 || originalTemplate.image_1,
        duplicateData.image_2 || originalTemplate.image_2,
        duplicateData.image_3 || originalTemplate.image_3,
        duplicateData.image_4 || originalTemplate.image_4,
        duplicateData.image_1 || originalTemplate.cover_image, // Use first image as cover
        '1.0.0', // Reset version
      ];

      console.log('Insert query:', insertQuery);
      console.log('Values:', values);

      const result = await this.dataSource.query(insertQuery, values);

      return {
        success: true,
        data: result[0],
        message: 'Template duplicated successfully',
      };
    } catch (error) {
      console.error('Duplicate template error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack,
      };
    }
  }
}
