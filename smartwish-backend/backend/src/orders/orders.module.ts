import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { PaymentSession } from './payment-session.entity';
import { Transaction } from './transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, PaymentSession, Transaction]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

