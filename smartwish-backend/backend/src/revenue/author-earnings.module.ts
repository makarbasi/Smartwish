import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevenueRecord } from './revenue-record.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { AuthorEarningsController } from './author-earnings.controller';
import { AuthorEarningsService } from './author-earnings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RevenueRecord, TemplatePurchase])],
  controllers: [AuthorEarningsController],
  providers: [AuthorEarningsService],
  exports: [AuthorEarningsService],
})
export class AuthorEarningsModule {}
