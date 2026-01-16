import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { PaymentSession } from './payment-session.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

@Entity('transactions')
@Index(['orderId'])
@Index(['userId'])
@Index(['status'])
@Index(['stripePaymentIntentId'])
@Index(['createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'payment_session_id', type: 'varchar', length: 100, nullable: true })
  paymentSessionId?: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Transaction details
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  // Stripe details
  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', length: 255, nullable: true, unique: true })
  stripePaymentIntentId?: string;

  @Column({ name: 'stripe_charge_id', type: 'varchar', length: 255, nullable: true })
  stripeChargeId?: string;

  // Status
  @Column({
    type: 'varchar',
    length: 20,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  // Payment details
  @Column({ name: 'payment_method_type', type: 'varchar', length: 50, nullable: true })
  paymentMethodType?: string;

  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4?: string;

  @Column({ name: 'card_brand', type: 'varchar', length: 20, nullable: true })
  cardBrand?: string;

  // Failure info
  @Column({ name: 'failure_code', type: 'varchar', length: 50, nullable: true })
  failureCode?: string;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage?: string;

  // ✅ FIX Bug #25: Removed refund columns - they don't exist in database schema
  // TODO: Add these columns to database migration if refund functionality is needed
  // @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  // refundAmount?: number;
  //
  // @Column({ name: 'refund_reason', type: 'text', nullable: true })
  // refundReason?: string;
  //
  // @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  // refundedAt?: Date;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => PaymentSession, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_session_id' })
  paymentSession?: PaymentSession;
}

