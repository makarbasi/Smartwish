import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthorEarningsService } from './author-earnings.service';

@Controller('api/authors')
@UseGuards(JwtAuthGuard)
export class AuthorEarningsController {
  constructor(private readonly earningsService: AuthorEarningsService) {}

  @Get('my-earnings')
  async getMyEarnings(
    @Request() req: any,
    @Query('timeRange') timeRange: string = '6months',
  ) {
    return this.earningsService.getAuthorEarnings(req.user.id, timeRange);
  }

  @Get(':authorId/earnings')
  async getAuthorEarnings(
    @Param('authorId', ParseUUIDPipe) authorId: string,
    @Query('timeRange') timeRange: string = '6months',
    @Request() req: any,
  ) {
    // Only allow users to see their own earnings or if they have admin role
    if (req.user.id !== authorId && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own earnings');
    }
    return this.earningsService.getAuthorEarnings(authorId, timeRange);
  }

  @Get('my-earnings/summary')
  async getMyEarningsSummary(@Request() req: any) {
    return this.earningsService.getEarningsSummary(req.user.id);
  }

  @Get('my-earnings/payouts')
  async getMyPayouts(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.earningsService.getAuthorPayouts(req.user.id, page, limit);
  }

  @Get('my-earnings/top-templates')
  async getMyTopTemplates(
    @Request() req: any,
    @Query('limit') limit: number = 10,
    @Query('timeRange') timeRange: string = '6months',
  ) {
    return this.earningsService.getTopPerformingTemplates(req.user.id, limit, timeRange);
  }

  @Get('my-earnings/analytics')
  async getMyAnalytics(
    @Request() req: any,
    @Query('timeRange') timeRange: string = '6months',
    @Query('granularity') granularity: string = 'monthly',
  ) {
    return this.earningsService.getDetailedAnalytics(req.user.id, timeRange, granularity);
  }
}
