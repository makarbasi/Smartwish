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
import { SavedDesignLikesService } from './saved-design-likes.service';

@Controller('api/saved-designs')
export class SavedDesignLikesController {
  constructor(private readonly likesService: SavedDesignLikesService) {}

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async likeDesign(
    @Param('id', ParseUUIDPipe) designId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return await this.likesService.likeDesign(designId, userId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unlikeDesign(
    @Param('id', ParseUUIDPipe) designId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return await this.likesService.unlikeDesign(designId, userId);
  }

  @Get(':id/like-status')
  @UseGuards(JwtAuthGuard)
  async getLikeStatus(
    @Param('id', ParseUUIDPipe) designId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const [isLiked, likesCount] = await Promise.all([
      this.likesService.hasUserLiked(designId, userId),
      this.likesService.getLikesCount(designId),
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
    const designIds = ids.split(',').filter(id => id.trim());
    const likesStatus = await this.likesService.getMultipleLikesStatus(designIds, userId);
    return { likesStatus };
  }

  @Get('likes/user')
  @UseGuards(JwtAuthGuard)
  async getUserLikedDesigns(@Request() req: any) {
    const userId = req.user.id;
    const designIds = await this.likesService.getUserLikedDesigns(userId);
    return { designIds, count: designIds.length };
  }
}





