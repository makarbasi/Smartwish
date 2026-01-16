import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KioskConfig } from './kiosk-config.entity';
import { User } from '../user/user.entity';

export enum PrintStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RefundStatus {
  PARTIAL = 'partial',
  FULL = 'full',
}

@Entity('kiosk_print_logs')
export class KioskPrintLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kiosk_id' })
  kioskId: string;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk: KioskConfig;

  // What was printed
  @Column({ name: 'product_type', default: 'greeting-card' })
  productType: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'product_name', nullable: true })
  productName: string;

  // PDF Storage (for reprints)
  @Column({ name: 'pdf_url', nullable: true, type: 'text' })
  pdfUrl: string;

  // Pricing / Revenue
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  // Stripe Payment Info (for refunds)
  @Column({ name: 'stripe_payment_intent_id', nullable: true })
  stripePaymentIntentId: string;

  @Column({ name: 'stripe_charge_id', nullable: true })
  stripeChargeId: string;

  // Tillo Gift Card Info
  @Column({ name: 'tillo_order_id', nullable: true })
  tilloOrderId: string;

  @Column({ name: 'tillo_transaction_ref', nullable: true })
  tilloTransactionRef: string;

  @Column({ name: 'gift_card_brand', nullable: true })
  giftCardBrand: string;

  @Column({ name: 'gift_card_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  giftCardAmount: number;

  @Column({ name: 'gift_card_code', nullable: true })
  giftCardCode: string;

  // Print details
  @Column({ name: 'printer_name', nullable: true })
  printerName: string;

  @Column({ name: 'paper_type', nullable: true })
  paperType: string;

  @Column({ name: 'paper_size', nullable: true })
  paperSize: string;

  @Column({ name: 'tray_number', nullable: true })
  trayNumber: number;

  @Column({ default: 1 })
  copies: number;

  // Status
  @Column({
    type: 'varchar',
    default: PrintStatus.PENDING,
  })
  status: PrintStatus;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  // Reprint tracking
  @Column({ name: 'reprint_count', default: 0 })
  reprintCount: number;

  @Column({ name: 'last_reprinted_at', nullable: true })
  lastReprintedAt: Date;

  @Column({ name: 'last_reprinted_by', nullable: true })
  lastReprintedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'last_reprinted_by' })
  reprinter: User;

  // Refund tracking
  @Column({ name: 'refund_status', type: 'varchar', nullable: true })
  refundStatus: RefundStatus;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  refundAmount: number;

  @Column({ name: 'refunded_at', nullable: true })
  refundedAt: Date;

  @Column({ name: 'refunded_by', nullable: true })
  refundedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'refunded_by' })
  refunder: User;

  @Column({ name: 'refund_reason', nullable: true, type: 'text' })
  refundReason: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  // Who initiated
  @Column({ name: 'initiated_by', nullable: true })
  initiatedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiator: User;
}
