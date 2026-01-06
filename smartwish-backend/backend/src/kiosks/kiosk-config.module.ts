import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskConfigService } from './kiosk-config.service';
import {
  KioskConfigAdminController,
  KioskConfigPublicController,
  KioskPublicController,
  KioskManagerController,
  ManagerAdminController,
} from './kiosk-config.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KioskConfig, KioskManager, User])],
  controllers: [
    KioskConfigPublicController,
    KioskPublicController,
    KioskManagerController,
    KioskConfigAdminController,
    ManagerAdminController,
  ],
  providers: [KioskConfigService],
  exports: [KioskConfigService],
})
export class KioskConfigModule {}
