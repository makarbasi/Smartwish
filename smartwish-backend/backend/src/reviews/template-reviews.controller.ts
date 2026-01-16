import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplateReviewsService } from './template-reviews.service';
import { CreateReviewDto, UpdateReviewDto, VoteReviewDto } from './dto/review.dto';

@Controller('api/reviews')
export class TemplateReviewsController {
  constructor(private readonly reviewsService: TemplateReviewsService) {}

  @Get('template/:templateId')
  async getTemplateReviews(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: string = 'helpful',
  ) {
    return this.reviewsService.getTemplateReviews(templateId, page, limit, sortBy);
  }

  @Get(':id')
  async getReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.getReviewById(id);
  }

  @Post('template/:templateId')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body(ValidationPipe) createReviewDto: CreateReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.createReview(templateId, createReviewDto, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateReviewDto: UpdateReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.updateReview(id, updateReviewDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteReview(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.reviewsService.deleteReview(id, req.user.id);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  async voteOnReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body(ValidationPipe) voteReviewDto: VoteReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.voteOnReview(reviewId, voteReviewDto.isHelpful, req.user.id);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() reportData: { reason: string },
    @Request() req: any,
  ) {
    return this.reviewsService.reportReview(reviewId, reportData.reason, req.user.id);
  }

  @Post(':id/hide')
  @UseGuards(JwtAuthGuard)
  async hideReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() hideData: { reason: string },
    @Request() req: any,
  ) {
    return this.reviewsService.hideReview(reviewId, hideData.reason, req.user.id);
  }

  @Get('user/:userId')
  async getUserReviews(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.reviewsService.getUserReviews(userId, page, limit);
  }
}
