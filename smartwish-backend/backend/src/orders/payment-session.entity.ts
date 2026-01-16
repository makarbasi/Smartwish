import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum PaymentSessionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('payment_sessions')
@Index(['orderId'])
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class PaymentSession {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string; // PAY-xxx format

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Payment details
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  // Stripe integration
  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', length: 255, nullable: true })
  stripePaymentIntentId?: string;

  @Column({ name: 'stripe_client_secret', type: 'varchar', length: 255, nullable: true })
  stripeClientSecret?: string;

  // Session status
  @Column({
    type: 'varchar',
    length: 20,
    default: PaymentSessionStatus.PENDING,
  })
  status: PaymentSessionStatus;

  // Device tracking
  @Column({ name: 'initiated_from', type: 'varchar', length: 20, nullable: true })
  initiatedFrom?: string; // kiosk, mobile, web

  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true })
  paymentMethod?: string; // card_kiosk, qr_mobile

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}

