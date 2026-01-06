import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskConfigService } from './kiosk-config.service';
import {
  KioskConfigAdminController,
  KioskConfigPublicController,
  KioskPublicController,
  KioskManagerController,
  ManagerAdminController,
  ManagersPublicController,
} from './kiosk-config.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KioskConfig, KioskManager, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
          issuer: 'smartwish-app',
          audience: 'smartwish-users',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    KioskConfigPublicController,
    KioskPublicController,
    ManagersPublicController,
    KioskManagerController,
    KioskConfigAdminController,
    ManagerAdminController,
  ],
  providers: [KioskConfigService],
  exports: [KioskConfigService],
})
export class KioskConfigModule {}
