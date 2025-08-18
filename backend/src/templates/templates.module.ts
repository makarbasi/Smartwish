import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TestController } from './test.controller';
import { SimpleCategoriesController } from './simple-categories.controller';
import { SimpleTemplatesController } from './simple-templates.controller';
import { Template } from './template.entity';
import { Category } from './category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template, Category])],
  controllers: [TemplatesController, CategoriesController, TestController, SimpleCategoriesController, SimpleTemplatesController],
  providers: [TemplatesService, CategoriesService],
  exports: [TemplatesService, CategoriesService],
})
export class TemplatesModule {}