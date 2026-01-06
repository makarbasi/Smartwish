import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskPrintLog } from './kiosk-print-log.entity';
import { KioskConfigService } from './kiosk-config.service';
import {
  KioskConfigAdminController,
  KioskConfigPublicController,
  KioskPublicController,
  KioskManagerController,
  ManagerAdminController,
  ManagersPublicController,
  KioskPrintLogController,
  ManagerPrintLogController,
  AdminPrintLogController,
} from './kiosk-config.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KioskConfig, KioskManager, KioskPrintLog, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
        console.log('[KioskConfigModule] JWT Secret configured:', secret ? 'Yes' : 'No (using default)');
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
            issuer: 'smartwish-app',
            audience: 'smartwish-users',
          },
        };
      },
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
    KioskPrintLogController,
    ManagerPrintLogController,
    AdminPrintLogController,
  ],
  providers: [KioskConfigService],
  exports: [KioskConfigService],
})
export class KioskConfigModule {}
