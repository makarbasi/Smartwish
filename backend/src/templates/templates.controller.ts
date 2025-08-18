import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('api/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllTemplates(
    @Query('category') categoryId?: string,
    @Query('search') searchTerm?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : undefined;

    const templates = await this.templatesService.findAll({
      categoryId,
      searchTerm,
      sortBy,
      sortOrder: sortOrder || 'asc',
      limit: limitNum,
      offset: offsetNum,
    });

    return {
      success: true,
      data: templates,
      total: templates.length,
    };
  }

  @Get('category/:categoryId')
  @UseGuards(OptionalJwtAuthGuard)
  async getTemplatesByCategory(@Param('categoryId') categoryId: string) {
    const templates = await this.templatesService.findByCategory(categoryId);
    
    return {
      success: true,
      data: templates,
      total: templates.length,
    };
  }

  @Get('search/:searchTerm')
  @UseGuards(OptionalJwtAuthGuard)
  async searchTemplates(@Param('searchTerm') searchTerm: string) {
    const templates = await this.templatesService.searchTemplates(searchTerm);
    
    return {
      success: true,
      data: templates,
      total: templates.length,
    };
  }

  @Get('stats')
  @UseGuards(OptionalJwtAuthGuard)
  async getTemplateStats() {
    const stats = await this.templatesService.getTemplateStats();
    
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getTemplateById(@Param('id') id: string) {
    const template = await this.templatesService.findById(id);
    
    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      };
    }

    return {
      success: true,
      data: template,
    };
  }
}