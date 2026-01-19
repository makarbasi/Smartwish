import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskPrintLog } from './kiosk-print-log.entity';
import { KioskPrinter } from './kiosk-printer.entity';
import { KioskAlert } from './kiosk-alert.entity';
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
  LocalPrintAgentController,
  KioskPrinterAdminController,
  PrinterStatusSSEController,
} from './kiosk-config.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KioskConfig, KioskManager, KioskPrintLog, KioskPrinter, KioskAlert, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
        const issuer = configService.get<string>('JWT_ISSUER') || 'smartwish-app';
        const audience = configService.get<string>('JWT_AUDIENCE') || 'smartwish-users';
        console.log('[KioskConfigModule] JWT configured - Secret:', secret ? 'Yes' : 'No', '| Issuer:', issuer, '| Audience:', audience);
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
            issuer,
            audience,
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
    LocalPrintAgentController,
    KioskPrinterAdminController,
    PrinterStatusSSEController,
  ],
  providers: [KioskConfigService],
  exports: [KioskConfigService],
})
export class KioskConfigModule {}
