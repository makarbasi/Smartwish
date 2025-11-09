import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedDesignsController } from './saved-designs.controller';
import { SavedDesignsService } from './saved-designs.service';
import { SupabaseSavedDesignsService } from './supabase-saved-designs.service';
import { SavedDesignEntity } from './saved-designs.entity';
import { SupabaseStorageService } from './supabase-storage.service';
import { SavedDesignLikesController } from './saved-design-likes.controller';
import { SavedDesignLikesService } from './saved-design-likes.service';
import { AuthModule } from '../auth/auth.module';
import { GeminiEmbeddingService } from '../services/gemini-embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedDesignEntity])],
  controllers: [SavedDesignsController, SavedDesignLikesController],
  providers: [
    SavedDesignsService,
    SupabaseSavedDesignsService,
    SupabaseStorageService,
    GeminiEmbeddingService,
    SavedDesignLikesService,
  ],
  exports: [
    SavedDesignsService,
    SupabaseSavedDesignsService,
    SupabaseStorageService,
    SavedDesignLikesService,
  ],
})
export class SavedDesignsModule { }
