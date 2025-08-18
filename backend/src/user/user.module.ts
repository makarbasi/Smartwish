import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { AuditModule } from '../common/audit/audit.module';
import { LoggerService } from '../common/logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditModule],
  controllers: [UserController],
  providers: [UserService, LoggerService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
