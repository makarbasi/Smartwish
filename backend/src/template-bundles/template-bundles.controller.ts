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
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { TemplateBundlesService } from './template-bundles.service';
import { CreateBundleDto, UpdateBundleDto, PurchaseBundleDto } from './dto/bundle.dto';

@Controller('api/bundles')
export class TemplateBundlesController {
  constructor(private readonly bundlesService: TemplateBundlesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getBundles(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('category') categoryId?: string,
    @Query('culture') cultureId?: string,
    @Query('region') regionId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'popular',
    @Request() req?: any,
  ) {
    return this.bundlesService.getBundles(
      page,
      limit,
      {
        categoryId,
        cultureId,
        regionId,
        search,
        sortBy,
      },
      req?.user?.id,
    );
  }

  @Get('featured')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeaturedBundles(@Request() req?: any) {
    return this.bundlesService.getFeaturedBundles(req?.user?.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getBundle(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.bundlesService.getBundleById(id, req?.user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createBundle(
    @Body(ValidationPipe) createBundleDto: CreateBundleDto,
    @Request() req: any,
  ) {
    return this.bundlesService.createBundle(createBundleDto, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateBundle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateBundleDto: UpdateBundleDto,
    @Request() req: any,
  ) {
    return this.bundlesService.updateBundle(id, updateBundleDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteBundle(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.bundlesService.deleteBundle(id, req.user.id);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseBundle(
    @Param('id', ParseUUIDPipe) bundleId: string,
    @Body(ValidationPipe) purchaseBundleDto: PurchaseBundleDto,
    @Request() req: any,
  ) {
    return this.bundlesService.purchaseBundle(bundleId, purchaseBundleDto, req.user.id);
  }

  @Post(':id/view')
  async incrementViewCount(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundlesService.incrementViewCount(id);
  }

  @Get('user/:userId')
  async getUserBundles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.bundlesService.getUserBundles(userId, page, limit);
  }

  @Get('user/:userId/purchased')
  @UseGuards(JwtAuthGuard)
  async getUserPurchasedBundles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Request() req: any,
  ) {
    // Only allow users to see their own purchased bundles
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only view your own purchased bundles');
    }
    return this.bundlesService.getUserPurchasedBundles(userId, page, limit);
  }
}
