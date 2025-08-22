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
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SavedDesignsService, SavedDesign } from './saved-designs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

@Controller('saved-designs')
@UseGuards(JwtAuthGuard)
export class SavedDesignsController {
  constructor(private readonly savedDesignsService: SavedDesignsService) {}

  @Post()
  async saveDesign(
    @Body()
    designData: Omit<SavedDesign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      console.log('saveDesign: Request user object:', req.user);

      const userId = req.user?.id?.toString();
      console.log('saveDesign: Final userId:', userId);

      if (!userId) {
        console.log('saveDesign: No userId found, returning 401');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('saveDesign: Saving design for userId:', userId);
      const savedDesign = await this.savedDesignsService.saveDesign(
        userId,
        designData,
      );
      console.log('saveDesign: Design saved successfully');
      res.json(savedDesign);
    } catch (error: unknown) {
      console.error('Error saving design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to save design', error: msg });
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
    } catch (error: unknown) {
      console.error('Error getting user designs:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to get designs', error: msg });
    }
  }

  // NOTE: Place static specific route BEFORE dynamic ':id' to avoid capturing
  @Get('published-to-templates')
  async getPublishedToTemplates(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const publishedDesigns =
        await this.savedDesignsService.getPublishedToTemplates(userId);

      res.json(publishedDesigns);
    } catch (error: unknown) {
      console.error('Error getting published to templates:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res
        .status(500)
        .json({ message: 'Failed to get published to templates', error: msg });
    }
  }

  // Constrain :id to UUID to avoid capturing static routes like 'published-to-templates'
  @Get(':id')
  async getDesignById(
    @Param('id', new ParseUUIDPipe()) designId: string,
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
    } catch (error: unknown) {
      console.error('Error getting design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to get design', error: msg });
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
    } catch (error: unknown) {
      console.error('Error getting public design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to get design', error: msg });
    }
  }

  @Put(':id')
  async updateDesign(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Body() updates: Partial<SavedDesign>,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const updatedDesign = await this.savedDesignsService.updateDesign(
        userId,
        designId,
        updates,
      );
      if (!updatedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(updatedDesign);
    } catch (error: unknown) {
      console.error('Error updating design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to update design', error: msg });
    }
  }

  @Delete(':id')
  async deleteDesign(
    @Param('id', new ParseUUIDPipe()) designId: string,
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
    } catch (error: unknown) {
      console.error('Error deleting design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to delete design', error: msg });
    }
  }

  @Post(':id/duplicate')
  async duplicateDesign(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Body() body: { title?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

  console.log(`Duplicating design ${designId} for user ${userId}`);
      const duplicatedDesign = await this.savedDesignsService.duplicateDesign(
        userId,
        designId,
        body.title,
      );
      
      if (!duplicatedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      console.log(
        `Design duplicated successfully with ID: ${duplicatedDesign.id}`,
      );
      res.json({
        message: `Design duplicated as "${duplicatedDesign.title}"`,
        design: duplicatedDesign,
      });
    } catch (error: unknown) {
      console.error('Error duplicating design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to duplicate design',
        error: msg,
      });
    }
  }

  @Post(':id/share')
  async createSharedCopy(
    @Param('id', new ParseUUIDPipe()) designId: string,
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
    } catch (error: unknown) {
      console.error('Error creating shared copy:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to create shared copy',
        error: msg,
      });
    }
  }

  @Post(':id/publish')
  async publishDesign(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const publishedDesign = await this.savedDesignsService.publishDesign(
        userId,
        designId,
      );
      if (!publishedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(publishedDesign);
    } catch (error: unknown) {
      console.error('Error publishing design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to publish design', error: msg });
    }
  }

  @Post(':id/publish-with-metadata')
  async publishDesignWithMetadata(
    @Param('id', new ParseUUIDPipe()) designId: string,
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
    } catch (error: unknown) {
      console.error('Error publishing design with metadata:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ message: 'Failed to publish design', error: msg });
    }
  }

  @Post(':id/unpublish')
  async unpublishDesign(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const unpublishedDesign = await this.savedDesignsService.unpublishDesign(
        userId,
        designId,
      );
      if (!unpublishedDesign) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(unpublishedDesign);
    } catch (error: unknown) {
      console.error('Error unpublishing design:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res
        .status(500)
        .json({ message: 'Failed to unpublish design', error: msg });
    }
  }

  @Get('published/all')
  @Public()
  async getPublishedDesigns(@Res() res: Response) {
    try {
      const publishedDesigns =
        await this.savedDesignsService.getPublishedDesigns();
      res.json(publishedDesigns);
    } catch (error: unknown) {
      console.error('Error getting published designs:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to get published designs',
        error: msg,
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
    } catch (error: unknown) {
      console.error('Error copying from template:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to copy from template',
        error: msg,
      });
    }
  }

  @Post(':id/publish-to-templates')
  async publishToTemplates(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      // Directly use promoteToTemplate to bypass missing primary RPC function issues
      const result = await this.savedDesignsService.promoteToTemplate(
        designId,
        userId,
      );

      if (!result) {
        return res.status(404).json({ message: 'Design not found' });
      }

      res.json(result);
    } catch (error: unknown) {
      console.error('Error publishing to templates:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to publish to templates',
        error: msg,
      });
    }
  }

  @Post(':id/promote-to-template')
  async promoteToTemplate(
    @Param('id', new ParseUUIDPipe()) designId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const result = await this.savedDesignsService.promoteToTemplate(
        designId,
        userId,
      );
      if (!result) {
        return res.status(404).json({ message: 'Design not found' });
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error promoting to template:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to promote to template',
        error: msg,
      });
    }
  }

  @Get('available-templates')
  async getAvailableTemplates(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id?.toString();
      const category = req.query.category as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const templates = await this.savedDesignsService.getAvailableTemplates(
        userId,
        category,
        limit,
        offset,
      );

      res.json(templates);
    } catch (error: unknown) {
      console.error('Error getting available templates:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        message: 'Failed to get available templates',
        error: msg,
      });
    }
  }
}
