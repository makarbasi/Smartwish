import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateCollection } from './template-collection.entity';
import { TemplateCollectionItem } from './template-collection-item.entity';
import { TemplateCollectionsController } from './template-collections.controller';
import { TemplateCollectionsService } from './template-collections.service';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateCollection, TemplateCollectionItem])],
  controllers: [TemplateCollectionsController],
  providers: [TemplateCollectionsService],
  exports: [TemplateCollectionsService],
})
export class TemplateCollectionsModule {}
