import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedDesignsController } from './saved-designs.controller';
import { SavedDesignsService } from './saved-designs.service';
import { SupabaseSavedDesignsService } from './supabase-saved-designs.service';
import { SavedDesignEntity } from './saved-designs.entity';
import { SupabaseStorageService } from './supabase-storage.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedDesignEntity])],
  controllers: [SavedDesignsController],
  providers: [
    SavedDesignsService,
    SupabaseSavedDesignsService,
    SupabaseStorageService,
  ],
  exports: [
    SavedDesignsService,
    SupabaseSavedDesignsService,
    SupabaseStorageService,
  ],
})
export class SavedDesignsModule {}
