import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EarningsLedger } from './earnings-ledger.entity';
import { EarningsService } from './earnings.service';
import {
  AdminEarningsController,
  ManagerEarningsController,
  KioskEarningsController,
} from './earnings.controller';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { KioskManager } from '../kiosks/kiosk-manager.entity';
import { SalesRepresentative } from '../sales-representatives/sales-representative.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EarningsLedger,
      KioskConfig,
      KioskManager,
      SalesRepresentative,
    ]),
  ],
  controllers: [
    AdminEarningsController,
    ManagerEarningsController,
    KioskEarningsController,
  ],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
