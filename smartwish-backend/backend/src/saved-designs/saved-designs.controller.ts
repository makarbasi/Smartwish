import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SavedDesignsService, SavedDesign } from './saved-designs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

@Controller('saved-designs')
@UseGuards(JwtAuthGuard)
export class SavedDesignsController {
  constructor(private readonly savedDesignsService: SavedDesignsService) { }

  @Post()
  async saveDesign(
    @Body() designData: Omit<SavedDesign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) return res.status(401).json({ message: 'User not authenticated' });
      const savedDesign = await this.savedDesignsService.saveDesign(userId, designData);
      res.json(savedDesign);
    } catch (e) {
      res.status(500).json({ message: 'Failed to save design', error: (e as any)?.message });
    }
  }

  @Get()
  async getUserDesigns(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      console.log('getUserDesigns: Request user object:', req.user);
      console.log('getUserDesigns: Request headers:', req.headers);

      const userId = req.user?.id?.toString();
      console.log('getUserDesigns: Extracted userId:', userId);

      if (!userId) {
        console.log('getUserDesigns: No userId found, returning 401');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('getUserDesigns: Fetching designs for userId:', userId);
      const designs = await this.savedDesignsService.getUserDesigns(userId);
      console.log('getUserDesigns: Found designs count:', designs.length);
      res.json(designs);
    } catch (error) {
      console.error('Error getting user designs:', error);
      res
        .status(500)
        .json({ message: 'Failed to get designs', error: error.message });
    }
  }

  @Get(':id')
  async getDesignById(
    @Param('id') designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const design = await this.savedDesignsService.getDesignById(
        userId,
        designId,
      );
      if (!design) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(design);
    } catch (error) {
      console.error('Error getting design:', error);
      res
        .status(500)
        .json({ message: 'Failed to get design', error: error.message });
    }
  }

  @Get('public/:id')
  @Public()
  async getPublicDesignById(
    @Param('id') designId: string,
    @Res() res: Response,
  ) {
    try {
      const design =
        await this.savedDesignsService.getPublicDesignById(designId);
      if (!design) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(design);
    } catch (error) {
      console.error('Error getting public design:', error);
      res
        .status(500)
        .json({ message: 'Failed to get design', error: error.message });
    }
  }

  @Put(':id')
  async updateDesign(
    @Param('id') designId: string,
    @Body() updates: Partial<SavedDesign>,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('🔄 UpdateDesign - Design ID:', designId);
      console.log(
        '🔄 UpdateDesign - Updates body:',
        JSON.stringify(updates, null, 2),
      );
      console.log(
        '🔄 UpdateDesign - CategoryId in updates:',
        updates.categoryId,
      );

      const updatedDesign = await this.savedDesignsService.updateDesign(
        userId,
        designId,
        updates,
      );
      if (!updatedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      console.log(
        '✅ UpdateDesign - Updated design category:',
        updatedDesign.categoryId,
      );
      res.json(updatedDesign);
    } catch (error) {
      console.error('Error updating design:', error);
      res
        .status(500)
        .json({ message: 'Failed to update design', error: error.message });
    }
  }

  @Delete(':id')
  async deleteDesign(
    @Param('id') designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const deleted = await this.savedDesignsService.deleteDesign(
        userId,
        designId,
      );
      if (!deleted) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json({ message: 'Design deleted successfully' });
    } catch (error) {
      console.error('Error deleting design:', error);
      res
        .status(500)
        .json({ message: 'Failed to delete design', error: error.message });
    }
  }

  @Post(':id/duplicate')
  async duplicateDesign(
    @Param('id') designId: string,
    @Body() body: { title?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        console.log('Duplicate: User not authenticated');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log(
        `Duplicate: Starting duplication of design ${designId} for user ${userId}`,
      );
      console.log('Duplicate: Request body:', body);

      const duplicatedDesign = await this.savedDesignsService.duplicateDesign(
        userId,
        designId,
        body.title,
      );

      console.log(
        'Duplicate: Service returned:',
        duplicatedDesign ? 'design object' : 'null',
      );

      if (!duplicatedDesign) {
        console.log('Duplicate: Design not found or duplication failed');
        return res.status(404).json({ message: 'Design not found' });
      }

      console.log(
        `Duplicate: Design duplicated successfully with ID: ${duplicatedDesign.id}`,
      );

      const response = {
        message: `Design duplicated as "${duplicatedDesign.title}"`,
        design: duplicatedDesign,
      };

      console.log('Duplicate: Sending response:', response);
      return res.json(response);
    } catch (error) {
      console.error('Duplicate: Error duplicating design:', error);
      console.error(
        'Duplicate: Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );

      const errorResponse = {
        message: 'Failed to duplicate design',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      console.log('Duplicate: Sending error response:', errorResponse);
      return res.status(500).json(errorResponse);
    }
  }

  @Post(':id/share')
  async createSharedCopy(
    @Param('id') designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const sharedDesign = await this.savedDesignsService.createSharedCopy(
        userId,
        designId,
      );
      if (!sharedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(sharedDesign);
    } catch (error) {
      console.error('Error creating shared copy:', error);
      res.status(500).json({
        message: 'Failed to create shared copy',
        error: error.message,
      });
    }
  }

  @Post(':id/publish')
  async publishDesign(
    @Param('id') designId: string,
    @Body() body: { title?: string; category_id?: string; description?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('📤 Publish - Design ID:', designId);
      console.log('📤 Publish - Title:', body.title);
      console.log('📤 Publish - Category:', body.category_id);
      console.log('📤 Publish - Description:', body.description);

      const publishedDesign = await this.savedDesignsService.publishDesign(
        userId,
        designId,
        body.title,
        body.category_id,
        body.description,
      );
      if (!publishedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(publishedDesign);
    } catch (error) {
      console.error('Error publishing design:', error);
      res
        .status(500)
        .json({ message: 'Failed to publish design', error: error.message });
    }
  }

  @Post(':id/publish-with-metadata')
  async publishDesignWithMetadata(
    @Param('id') designId: string,
    @Body()
    publishData: {
      title: string;
      description: string;
      category: string;
      searchKeywords: string[];
      language?: string;
      region?: string;
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const publishedDesign =
        await this.savedDesignsService.publishDesignWithMetadata(
          userId,
          designId,
          publishData,
        );

      if (!publishedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(publishedDesign);
    } catch (error) {
      console.error('Error publishing design with metadata:', error);
      res
        .status(500)
        .json({ message: 'Failed to publish design', error: error.message });
    }
  }

  @Post(':id/unpublish')
  async unpublishDesign(
    @Param('id') designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      console.log('🔓 Unpublish Controller - Request received:', {
        designId,
        userId,
        hasUser: !!req.user,
        userEmail: req.user?.email
      });

      if (!userId) {
        console.error('🔓 Unpublish Controller - No userId found');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const unpublishedDesign = await this.savedDesignsService.unpublishDesign(
        userId,
        designId,
      );

      if (!unpublishedDesign) {
        console.error('🔓 Unpublish Controller - Service returned null');
        return res.status(404).json({ message: 'Design not found' });
      }

      console.log('🔓 Unpublish Controller - Success');
      res.json(unpublishedDesign);
    } catch (error) {
      console.error('🔓 Unpublish Controller - Error:', error);
      res
        .status(500)
        .json({ message: 'Failed to unpublish design', error: error.message });
    }
  }

  @Get('published/user')
  async getUserPublishedDesigns(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const publishedDesigns =
        await this.savedDesignsService.getUserPublishedDesigns(userId);
      res.json(publishedDesigns);
    } catch (error) {
      console.error('Error getting user published designs:', error);
      res.status(500).json({
        message: 'Failed to get user published designs',
        error: error.message,
      });
    }
  }

  @Get('published/all')
  @Public()
  async getPublishedDesigns(@Res() res: Response) {
    try {
      const publishedDesigns =
        await this.savedDesignsService.getPublishedDesigns();
      res.json(publishedDesigns);
    } catch (error) {
      console.error('Error getting published designs:', error);
      res.status(500).json({
        message: 'Failed to get published designs',
        error: error.message,
      });
    }
  }

  // New endpoints for sw_templates compatibility

  @Post('copy-from-template/:templateId')
  async copyFromTemplate(
    @Param('templateId') templateId: string,
    @Body() copyData: { title?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const copiedDesign = await this.savedDesignsService.copyFromTemplate(
        templateId,
        userId,
        copyData.title,
      );
      if (!copiedDesign) {
        return res.status(404).json({ message: 'Template not found' });
      }
      res.json(copiedDesign);
    } catch (error) {
      console.error('Error copying from template:', error);
      res.status(500).json({
        message: 'Failed to copy from template',
        error: (error as any)?.message || 'Unknown error',
      });
    }
  }


  @Post('update-supabase-image')
  async updateSupabaseImage(
    @Body() body: { supabaseUrl: string; newImageData: string; designId?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const { supabaseUrl, newImageData, designId } = body;

      // Enhanced validation
      if (!supabaseUrl) {
        console.log('❌ Missing supabaseUrl in request body');
        return res.status(400).json({ error: 'Supabase URL is required' });
      }

      if (!newImageData) {
        console.log('❌ Missing newImageData in request body');
        return res.status(400).json({ error: 'New image data is required' });
      }

      // Validate URL format
      if (!supabaseUrl.includes('supabase') || !supabaseUrl.includes('smartwish-assets')) {
        console.log('❌ Invalid supabaseUrl format:', supabaseUrl);
        return res.status(400).json({ error: 'Invalid Supabase URL format' });
      }

      // Validate image data format
      if (!newImageData.startsWith('data:image/') && !newImageData.match(/^[A-Za-z0-9+/]+=*$/)) {
        console.log('❌ Invalid image data format - not data URL or base64');
        return res.status(400).json({ error: 'Invalid image data format. Expected data URL or base64 string' });
      }

      console.log('🔄 Updating Supabase image content for user:', userId);
      console.log('📍 URL:', supabaseUrl);
      console.log('📊 Image data size:', newImageData.length, 'characters');
      console.log('📋 Image data type:', newImageData.startsWith('data:') ? 'data URL' : 'base64');

      const updatedUrl = await this.savedDesignsService.updateImageContent(
        supabaseUrl,
        newImageData,
      );

      console.log('✅ Image update completed successfully');
      console.log('🔄 New versioned URL:', updatedUrl);

      // Always update saved designs to use the new versioned URL
      // We need to update because the new URL has a cache-busting parameter
      console.log('🔄 Updating saved designs to use new versioned URL...');

      // Extract base URL without version parameters for database search
      const baseUrl = supabaseUrl.split('?')[0];

      const updatedCount = await this.savedDesignsService.updateImageUrlsInDesigns(
        userId,
        baseUrl,
        updatedUrl,
        designId,
      );
      console.log(`✅ Updated ${updatedCount} saved designs with new image URL`);

      res.json({
        success: true,
        message: 'Image content updated successfully',
        url: updatedUrl,
      });
    } catch (error) {
      console.error('❌ Error updating Supabase image:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error details:', errorMessage);

      res.status(500).json({
        error: 'Failed to update image content',
        details: errorMessage,
      });
    }
  }
}
