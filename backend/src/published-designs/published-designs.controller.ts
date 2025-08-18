import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PublishedDesignsService, CreatePublishedDesignDto } from './published-designs.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('published-designs')
export class PublishedDesignsController {
  constructor(private readonly publishedDesignsService: PublishedDesignsService) {}

  /**
   * Publish a design from saved designs
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async publishDesign(
    @Body() publishData: CreatePublishedDesignDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      console.log('Publishing design request:', {
        title: publishData.title,
        userId: (req as any).user?.id,
        imagesCount: publishData.images?.length || 0
      });

      // Add user ID from authenticated request
      const publishDto: CreatePublishedDesignDto = {
        ...publishData,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email
      };

      const publishedDesign = await this.publishedDesignsService.publishDesign(publishDto);

      res.status(201).json({
        success: true,
        message: 'Design published successfully',
        data: publishedDesign
      });

    } catch (error) {
      console.error('Error publishing design:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to publish design',
        error: error.message
      });
    }
  }

  /**
   * Get all categories
   */
  @Get('categories')
  @Public()
  async getCategories(@Res() res: Response) {
    try {
      const categories = await this.publishedDesignsService.getCategories();

      res.json({
        success: true,
        data: categories,
        total: categories.length
      });

    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get categories',
        error: error.message
      });
    }
  }

  /**
   * Get all published designs (public endpoint)
   */
  @Get('all')
  @Public()
  async getAllPublishedDesigns(
    @Res() res: Response,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') categoryId?: string,
    @Query('author') authorId?: string,
    @Query('featured') featured?: string,
    @Query('sort') sortBy?: 'newest' | 'popular' | 'downloads' | 'rating',
  ) {
    try {
      const options = {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        categoryId,
        authorId,
        featured: featured === 'true',
        sortBy: sortBy || 'newest'
      };

      const publishedDesigns = await this.publishedDesignsService.getAllPublishedDesigns(options);

      res.json({
        success: true,
        data: publishedDesigns,
        total: publishedDesigns.length,
        pagination: {
          limit: options.limit,
          offset: options.offset
        }
      });

    } catch (error) {
      console.error('Error getting published designs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get published designs',
        error: error.message
      });
    }
  }

  /**
   * Get user's own published designs
   */
  @Get('my-designs')
  @UseGuards(JwtAuthGuard)
  async getUserPublishedDesigns(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userDesigns = await this.publishedDesignsService.getUserPublishedDesigns((req as any).user?.id);

      res.json({
        success: true,
        data: userDesigns,
        total: userDesigns.length
      });

    } catch (error) {
      console.error('Error getting user published designs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get your published designs',
        error: error.message
      });
    }
  }

  /**
   * Get single published design by ID
   */
  @Get('design/:id')
  @Public()
  async getPublishedDesignById(
    @Param('id') designId: string,
    @Res() res: Response,
  ) {
    try {
      const design = await this.publishedDesignsService.getPublishedDesignById(designId);

      if (!design) {
        return res.status(404).json({
          success: false,
          message: 'Published design not found'
        });
      }

      res.json({
        success: true,
        data: design
      });

    } catch (error) {
      console.error('Error getting published design:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get published design',
        error: error.message
      });
    }
  }

  /**
   * Unpublish a design (archive it)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async unpublishDesign(
    @Param('id') designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const success = await this.publishedDesignsService.unpublishDesign(designId, (req as any).user?.id);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to unpublish design'
        });
      }

      res.json({
        success: true,
        message: 'Design unpublished successfully'
      });

    } catch (error) {
      console.error('Error unpublishing design:', error);
      
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to unpublish design',
        error: error.message
      });
    }
  }

  /**
   * Record a download for a design
   */
  @Post(':id/download')
  @Public()
  async recordDownload(
    @Param('id') designId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      // Get user ID if authenticated, otherwise null for anonymous downloads
      const userId = req.user?.id || null;

      const success = await this.publishedDesignsService.recordDownload(designId, userId);

      res.json({
        success: true,
        message: success ? 'Download recorded' : 'Download tracking failed'
      });

    } catch (error) {
      console.error('Error recording download:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record download',
        error: error.message
      });
    }
  }

  /**
   * Get featured designs
   */
  @Get('featured/designs')
  @Public()
  async getFeaturedDesigns(
    @Res() res: Response,
    @Query('limit') limit?: string,
  ) {
    try {
      const options = {
        featured: true,
        limit: limit ? parseInt(limit, 10) : 12,
        sortBy: 'newest' as const
      };

      const featuredDesigns = await this.publishedDesignsService.getAllPublishedDesigns(options);

      res.json({
        success: true,
        data: featuredDesigns,
        total: featuredDesigns.length
      });

    } catch (error) {
      console.error('Error getting featured designs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get featured designs',
        error: error.message
      });
    }
  }

  /**
   * Search published designs
   */
  @Get('search/designs')
  @Public()
  async searchPublishedDesigns(
    @Res() res: Response,
    @Query('q') query?: string,
    @Query('category') categoryId?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sortBy?: 'newest' | 'popular' | 'downloads' | 'rating',
  ) {
    try {
      // For now, use the basic filter-based approach
      // In the future, this could be enhanced with full-text search
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        categoryId,
        sortBy: sortBy || 'newest'
      };

      let designs = await this.publishedDesignsService.getAllPublishedDesigns(options);

      // Simple text-based filtering if query provided
      if (query) {
        const searchTerm = query.toLowerCase();
        designs = designs.filter(design => 
          design.title.toLowerCase().includes(searchTerm) ||
          design.description.toLowerCase().includes(searchTerm) ||
          design.searchKeywords.some(keyword => keyword.toLowerCase().includes(searchTerm)) ||
          design.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      // Tag filtering
      if (tags) {
        const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
        designs = designs.filter(design =>
          design.tags.some(tag => tagList.includes(tag.toLowerCase()))
        );
      }

      res.json({
        success: true,
        data: designs,
        total: designs.length,
        query: {
          search: query,
          category: categoryId,
          tags,
          sort: sortBy
        }
      });

    } catch (error) {
      console.error('Error searching published designs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search published designs',
        error: error.message
      });
    }
  }

  /**
   * Get designs by category
   */
  @Get('category/:categoryId')
  @Public()
  async getDesignsByCategory(
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sortBy?: 'newest' | 'popular' | 'downloads' | 'rating',
  ) {
    try {
      const options = {
        categoryId,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        sortBy: sortBy || 'newest'
      };

      const designs = await this.publishedDesignsService.getAllPublishedDesigns(options);

      res.json({
        success: true,
        data: designs,
        total: designs.length,
        category: categoryId
      });

    } catch (error) {
      console.error('Error getting designs by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get designs by category',
        error: error.message
      });
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health/check')
  @Public()
  async healthCheck(@Res() res: Response) {
    try {
      const isConfigured = this.publishedDesignsService.isConfigured();
      
      res.json({
        success: true,
        service: 'Published Designs',
        status: isConfigured ? 'configured' : 'not configured',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        service: 'Published Designs',
        status: 'error',
        error: error.message
      });
    }
  }
}
