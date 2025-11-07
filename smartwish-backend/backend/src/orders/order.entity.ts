import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderType {
  PRINT = 'print',
  SEND_ECARD = 'send_ecard',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PROCESSING = 'payment_processing',
  PAID = 'paid',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('orders')
@Index(['userId'])
@Index(['cardId'])
@Index(['status'])
@Index(['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'card_id', type: 'uuid' })
  cardId: string;

  // Order details
  @Column({
    name: 'order_type',
    type: 'varchar',
    length: 20,
  })
  orderType: OrderType;

  @Column({ name: 'card_name', type: 'varchar', length: 255 })
  cardName: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255, nullable: true })
  recipientEmail?: string;

  // Pricing breakdown
  @Column({ name: 'card_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  cardPrice: number;

  @Column({ name: 'gift_card_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  giftCardAmount: number;

  @Column({ name: 'processing_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  processingFee: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  // Gift card details (if attached)
  @Column({ name: 'gift_card_product_name', type: 'varchar', length: 255, nullable: true })
  giftCardProductName?: string;

  @Column({ name: 'gift_card_redemption_link', type: 'text', nullable: true })
  giftCardRedemptionLink?: string;

  // Order status
  @Column({
    type: 'varchar',
    length: 20,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}

