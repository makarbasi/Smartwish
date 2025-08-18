import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllCategories() {
    const categories = await this.categoriesService.findAll();
    
    return {
      success: true,
      data: categories,
      total: categories.length,
    };
  }

  @Get('names')
  @UseGuards(OptionalJwtAuthGuard)
  async getCategoryNames() {
    const categoryNames = await this.categoriesService.getCategoryNames();
    
    return {
      success: true,
      data: categoryNames,
    };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoriesService.findById(id);
    
    if (!category) {
      return {
        success: false,
        error: 'Category not found',
      };
    }

    return {
      success: true,
      data: category,
    };
  }
}
