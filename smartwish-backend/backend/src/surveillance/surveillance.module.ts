import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveillanceDetection } from './surveillance-detection.entity';
import { SurveillanceDailyStats } from './surveillance-daily-stats.entity';
import { SurveillanceService } from './surveillance.service';
import { SurveillancePublicController, SurveillanceAdminController } from './surveillance.controller';
import { KioskConfig } from '../kiosks/kiosk-config.entity';

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
  ],
  providers: [SurveillanceService],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
