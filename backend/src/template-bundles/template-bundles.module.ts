import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateBundle } from './template-bundle.entity';
import { TemplateBundleItem } from './template-bundle-item.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { TemplateBundlesController } from './template-bundles.controller';
import { TemplateBundlesService } from './template-bundles.service';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateBundle, TemplateBundleItem, TemplatePurchase])],
  controllers: [TemplateBundlesController],
  providers: [TemplateBundlesService],
  exports: [TemplateBundlesService],
})
export class TemplateBundlesModule {}
