import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StickersService } from './stickers.service';

@Controller('stickers')
export class StickersController {
  constructor(private readonly stickersService: StickersService) {}

  /**
   * GET /stickers
   * List all stickers with optional search and filtering
   */
  @Get()
  async findAll(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.stickersService.findAll({
      q,
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      success: true,
      data: result.data,
      total: result.total,
      count: result.data.length,
    };
  }

  /**
   * GET /stickers/categories
   * Get list of all sticker categories
   */
  @Get('categories')
  async getCategories() {
    const categories = await this.stickersService.getCategories();
    return {
      success: true,
      data: categories,
    };
  }

  /**
   * GET /stickers/:id
   * Get a single sticker by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const sticker = await this.stickersService.findOne(id);
    return {
      success: true,
      data: sticker,
    };
  }

  /**
   * POST /stickers/:id/increment-popularity
   * Increment the popularity counter for a sticker
   */
  @Post(':id/increment-popularity')
  @HttpCode(HttpStatus.OK)
  async incrementPopularity(@Param('id') id: string) {
    await this.stickersService.incrementPopularity(id);
    return {
      success: true,
      message: 'Popularity incremented',
    };
  }
}
