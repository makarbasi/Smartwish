import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveillanceDetection } from './surveillance-detection.entity';
import { SurveillanceDailyStats } from './surveillance-daily-stats.entity';
import { SurveillanceService } from './surveillance.service';
import { SurveillancePublicController, SurveillanceAdminController, SurveillanceStreamController } from './surveillance.controller';
import { SurveillanceGateway } from './surveillance.gateway';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { SupabaseStorageService } from '../saved-designs/supabase-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SurveillanceDetection,
      SurveillanceDailyStats,
      KioskConfig,
    ]),
  ],
  controllers: [
    SurveillancePublicController,
    SurveillanceAdminController,
    SurveillanceStreamController,
  ],
  providers: [SurveillanceService, SupabaseStorageService, SurveillanceGateway],
  exports: [SurveillanceService, SurveillanceGateway],
})
export class SurveillanceModule {}
