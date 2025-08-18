import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { SavedDesignsModule } from './saved-designs/saved-designs.module';
import { ContactsModule } from './contacts/contacts.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { TemplatesModule } from './templates/templates.module';
import { TemplateCollectionsModule } from './template-collections/template-collections.module';
import { TemplateReviewsModule } from './reviews/template-reviews.module';
import { TemplateBundlesModule } from './template-bundles/template-bundles.module';
import { AuthorEarningsModule } from './revenue/author-earnings.module';

import { SharingController } from './sharing/sharing.controller';
import { SharingService } from './sharing/sharing.service';
import { LoggerService } from './common/logger/logger.service';
import { AuditModule } from './common/audit/audit.module';
import { databaseConfig } from './config/database.config';
import { User } from './user/user.entity';
import { AuditLog } from './common/audit/audit-log.entity';
// New marketplace entities
import { TemplateCollection } from './template-collections/template-collection.entity';
import { TemplateCollectionItem } from './template-collections/template-collection-item.entity';
import { TemplateBundle } from './template-bundles/template-bundle.entity';
import { TemplateBundleItem } from './template-bundles/template-bundle-item.entity';
import { LicenseType } from './licensing/license-type.entity';
import { TemplateLicense } from './licensing/template-license.entity';
import { TemplatePurchase } from './purchases/template-purchase.entity';
import { RevenueRecord } from './revenue/revenue-record.entity';
import { TemplateRating } from './reviews/template-rating.entity';
import { RatingVote } from './reviews/rating-vote.entity';
import { Culture } from './cultures/culture.entity';
import { Region } from './regions/region.entity';
import { Template } from './templates/template.entity';
import { Category } from './templates/category.entity';
import { SupabaseTemplatesEnhancedService } from './templates/supabase-templates-enhanced.service';
import { TemplatesEnhancedController } from './templates/templates-enhanced.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env.production', '.env'],
    }),

    // Database
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([
      User, 
      AuditLog,
      // Marketplace entities
      TemplateCollection,
      TemplateCollectionItem,
      TemplateBundle,
      TemplateBundleItem,
      LicenseType,
      TemplateLicense,
      TemplatePurchase,
      RevenueRecord,
      TemplateRating,
      RatingVote,
      Culture,
      Region,
      Template,
      Category,
    ]),

    // Static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../../downloads'),
      serveRoot: '/downloads',
    }),

    // Feature modules
    AuthModule,
    UserModule,
    SavedDesignsModule,
    ContactsModule,
    MarketplaceModule,
    TemplatesModule,
    TemplateCollectionsModule,
    TemplateReviewsModule,
    TemplateBundlesModule,
    AuthorEarningsModule,
    AuditModule,
  ],
  controllers: [AppController, SharingController, TemplatesEnhancedController],
  providers: [AppService, SharingService, LoggerService, SupabaseTemplatesEnhancedService],
  exports: [LoggerService],
})
export class AppModule {
  constructor(private readonly logger: LoggerService) {
    this.logger.log('AppModule instantiated', {
      controllers: [AppController.name, SharingController.name],
      timestamp: new Date().toISOString(),
    });
  }
}
