import { Module } from '@nestjs/common';
import { PublishedDesignsController } from './published-designs.controller';
import { PublishedDesignsService } from './published-designs.service';
import { EnhancedStorageService } from '../storage/enhanced-storage.service';

@Module({
  controllers: [PublishedDesignsController],
  providers: [
    PublishedDesignsService,
    EnhancedStorageService
  ],
  exports: [
    PublishedDesignsService,
    EnhancedStorageService
  ]
})
export class PublishedDesignsModule {}
