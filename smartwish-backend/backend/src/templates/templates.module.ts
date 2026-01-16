import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TestController } from './test.controller';
import { SimpleCategoriesController } from './simple-categories.controller';
import { SimpleTemplatesController } from './simple-templates.controller';
// import { TemplateLikesController } from './template-likes.controller';
// import { TemplateLikesService } from './template-likes.service';
import { Template } from './template.entity';
import { Category } from './category.entity';
// import { TemplateLike } from './template-like.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template, Category])],
  controllers: [
    TemplatesController,
    CategoriesController,
    TestController,
    SimpleCategoriesController,
    SimpleTemplatesController,
    // TemplateLikesController, // DISABLED: sw_template_likes table doesn't exist
  ],
  providers: [TemplatesService, CategoriesService],
  exports: [TemplatesService, CategoriesService],
})
export class TemplatesModule {}