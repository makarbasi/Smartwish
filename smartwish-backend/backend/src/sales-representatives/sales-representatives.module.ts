import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SalesRepresentative } from './sales-representative.entity';
import { SalesRepresentativesService } from './sales-representatives.service';
import {
  AdminSalesRepController,
  SalesRepPublicController,
  SalesRepController,
} from './sales-representatives.controller';
import { User } from '../user/user.entity';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { EarningsLedger } from '../earnings/earnings-ledger.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesRepresentative,
      User,
      KioskConfig,
      EarningsLedger,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'smartwish-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    AdminSalesRepController,
    SalesRepPublicController,
    SalesRepController,
  ],
  providers: [SalesRepresentativesService],
  exports: [SalesRepresentativesService],
})
export class SalesRepresentativesModule {}
