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
import { StickersSearchService } from './stickers-search.service';

@Controller('stickers')
export class StickersController {
  constructor(
    private readonly stickersService: StickersService,
    private readonly stickersSearchService: StickersSearchService,
  ) {}

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
   * GET /stickers/search
   * Semantic search for stickers using AI embeddings
   */
  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: 'semantic' | 'keyword' | 'hybrid',
  ) {
    if (!q || q.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required',
        data: [],
      };
    }

    const searchOptions = {
      category,
      limit: limit ? parseInt(limit, 10) : undefined, // No limit by default
    };

    let results;
    const searchMode = mode || 'hybrid';

    switch (searchMode) {
      case 'semantic':
        results = await this.stickersSearchService.searchByEmbedding(q, searchOptions);
        break;
      case 'keyword':
        results = await this.stickersSearchService.keywordSearch(q, searchOptions);
        break;
      case 'hybrid':
      default:
        results = await this.stickersSearchService.hybridSearch(q, searchOptions);
        break;
    }

    return {
      success: true,
      data: results,
      count: results.length,
      query: q,
      mode: searchMode,
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
   * GET /stickers/:id/similar
   * Find stickers similar to a given sticker
   */
  @Get(':id/similar')
  async findSimilar(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.stickersSearchService.findSimilarStickers(id, {
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return {
      success: true,
      data: results,
      count: results.length,
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
