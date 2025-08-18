import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.entity';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [AuditService, LoggerService],
  exports: [AuditService],
})
export class AuditModule {}
