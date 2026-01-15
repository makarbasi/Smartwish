import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { SalesRepresentative } from '../sales-representatives/sales-representative.entity';

export enum TransactionType {
  GREETING_CARD = 'greeting_card',
  STICKER = 'sticker',
  ECARD = 'ecard',
  GENERIC_GIFT_CARD = 'generic_gift_card',
  CUSTOM_GIFT_CARD_PURCHASE = 'custom_gift_card_purchase',
  CUSTOM_GIFT_CARD_REDEMPTION = 'custom_gift_card_redemption',
}

@Entity({ name: 'earnings_ledger' })
export class EarningsLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Transaction Reference
  @Index()
  @Column({ name: 'kiosk_id', type: 'uuid' })
  kioskId!: string;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk!: KioskConfig;

  @Index()
  @Column({ name: 'transaction_type', type: 'varchar', length: 50 })
  transactionType!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null;

  // Financial Breakdown
  @Column({ name: 'gross_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  grossAmount!: number;

  @Column({ name: 'processing_fees', type: 'decimal', precision: 10, scale: 2, default: 0 })
  processingFees!: number;

  @Column({ name: 'state_tax', type: 'decimal', precision: 10, scale: 2, default: 0 })
  stateTax!: number;

  @Column({ name: 'cost_basis', type: 'decimal', precision: 10, scale: 2, default: 0 })
  costBasis!: number;

  @Column({ name: 'net_distributable', type: 'decimal', precision: 10, scale: 2, default: 0 })
  netDistributable!: number;

  // Commission Distributions
  @Column({ name: 'smartwish_earnings', type: 'decimal', precision: 10, scale: 2, default: 0 })
  smartwishEarnings!: number;

  @Column({ name: 'manager_earnings', type: 'decimal', precision: 10, scale: 2, default: 0 })
  managerEarnings!: number;

  @Index()
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager?: User;

  @Column({ name: 'manager_commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  managerCommissionRate?: number | null;

  @Column({ name: 'sales_rep_earnings', type: 'decimal', precision: 10, scale: 2, default: 0 })
  salesRepEarnings!: number;

  @Index()
  @Column({ name: 'sales_rep_id', type: 'uuid', nullable: true })
  salesRepId?: string | null;

  @ManyToOne(() => SalesRepresentative, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_rep_id' })
  salesRep?: SalesRepresentative;

  @Column({ name: 'sales_rep_commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  salesRepCommissionRate?: number | null;

  // Store payout for custom gift cards
  @Column({ name: 'store_payout', type: 'decimal', precision: 10, scale: 2, default: 0 })
  storePayout!: number;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null;

  // Metadata
  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName?: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: true })
  productName?: string | null;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  // Timestamps
  @Index()
  @Column({ name: 'transaction_date', type: 'timestamptz', default: () => 'NOW()' })
  transactionDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Link to related ledger entry (e.g., purchase -> redemption)
  @Column({ name: 'related_ledger_id', type: 'uuid', nullable: true })
  relatedLedgerId?: string | null;

  @ManyToOne(() => EarningsLedger, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_ledger_id' })
  relatedLedger?: EarningsLedger;
}
