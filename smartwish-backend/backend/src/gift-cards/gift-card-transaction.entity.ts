import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GiftCard } from './gift-card.entity';

export enum TransactionType {
  PURCHASE = 'purchase',
  REDEMPTION = 'redemption',
  ADJUSTMENT = 'adjustment',
  VOID = 'void',
  REFUND = 'refund',
}

@Entity({ name: 'gift_card_transactions' })
export class GiftCardTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'gift_card_id', type: 'uuid' })
  giftCardId!: string;

  @ManyToOne(() => GiftCard, (card) => card.transactions)
  @JoinColumn({ name: 'gift_card_id' })
  giftCard!: GiftCard;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: TransactionType,
  })
  transactionType!: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ name: 'balance_before', type: 'decimal', precision: 10, scale: 2 })
  balanceBefore!: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 10, scale: 2 })
  balanceAfter!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy?: string | null;

  @Column({ name: 'kiosk_id', type: 'uuid', nullable: true })
  kioskId?: string | null;

  @Column({ name: 'reference_id', type: 'varchar', length: 255, nullable: true })
  referenceId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
