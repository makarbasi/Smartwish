import { Module } from '@nestjs/common';
import { SessionRecordingsService } from './session-recordings.service';
import {
  SessionRecordingsPublicController,
  SessionRecordingsAdminController,
} from './session-recordings.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [
    SessionRecordingsPublicController,
    SessionRecordingsAdminController,
  ],
  providers: [SessionRecordingsService],
  exports: [SessionRecordingsService],
})
export class SessionRecordingsModule {}

