import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplateLikesService } from './template-likes.service';

@Controller('api/templates')
export class TemplateLikesController {
  constructor(private readonly likesService: TemplateLikesService) {}

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async likeTemplate(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return await this.likesService.likeTemplate(templateId, userId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unlikeTemplate(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return await this.likesService.unlikeTemplate(templateId, userId);
  }

  @Get(':id/like-status')
  @UseGuards(JwtAuthGuard)
  async getLikeStatus(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const [isLiked, likesCount] = await Promise.all([
      this.likesService.hasUserLiked(templateId, userId),
      this.likesService.getLikesCount(templateId),
    ]);
    return { isLiked, likes: likesCount };
  }

  @Get('likes/batch-status')
  @UseGuards(JwtAuthGuard)
  async getBatchLikeStatus(
    @Query('ids') ids: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const templateIds = ids.split(',').filter(id => id.trim());
    const likesStatus = await this.likesService.getMultipleLikesStatus(templateIds, userId);
    return { likesStatus };
  }

  @Get('likes/user')
  @UseGuards(JwtAuthGuard)
  async getUserLikedTemplates(@Request() req: any) {
    const userId = req.user.id;
    const templateIds = await this.likesService.getUserLikedTemplates(userId);
    return { templateIds, count: templateIds.length };
  }
}






