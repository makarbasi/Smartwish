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
import { TemplateCollectionsService } from './template-collections.service';
import { CreateCollectionDto, UpdateCollectionDto, AddTemplateDto } from './dto/collection.dto';

@Controller('api/collections')
@UseGuards(JwtAuthGuard)
export class TemplateCollectionsController {
  constructor(private readonly collectionsService: TemplateCollectionsService) {}

  @Get('my-collections')
  async getMyCollections(@Request() req: any) {
    return this.collectionsService.getUserCollections(req.user.id);
  }

  @Get('public')
  async getPublicCollections(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.collectionsService.getPublicCollections(page, limit, search);
  }

  @Get(':id')
  async getCollection(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.collectionsService.getCollectionById(id, req.user.id);
  }

  @Post()
  async createCollection(
    @Body(ValidationPipe) createCollectionDto: CreateCollectionDto,
    @Request() req: any,
  ) {
    return this.collectionsService.createCollection(createCollectionDto, req.user.id);
  }

  @Put(':id')
  async updateCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateCollectionDto: UpdateCollectionDto,
    @Request() req: any,
  ) {
    return this.collectionsService.updateCollection(id, updateCollectionDto, req.user.id);
  }

  @Delete(':id')
  async deleteCollection(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.collectionsService.deleteCollection(id, req.user.id);
  }

  @Post(':id/templates')
  async addTemplateToCollection(
    @Param('id', ParseUUIDPipe) collectionId: string,
    @Body(ValidationPipe) addTemplateDto: AddTemplateDto,
    @Request() req: any,
  ) {
    return this.collectionsService.addTemplateToCollection(
      collectionId,
      addTemplateDto.templateId,
      req.user.id,
    );
  }

  @Delete(':id/templates/:templateId')
  async removeTemplateFromCollection(
    @Param('id', ParseUUIDPipe) collectionId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Request() req: any,
  ) {
    return this.collectionsService.removeTemplateFromCollection(
      collectionId,
      templateId,
      req.user.id,
    );
  }

  @Post(':id/view')
  async incrementViewCount(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionsService.incrementViewCount(id);
  }
}
