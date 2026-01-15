import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GiftCardBrand } from './gift-card-brand.entity';
import { GiftCardTransaction } from './gift-card-transaction.entity';

export enum GiftCardStatus {
  ACTIVE = 'active',
  DEPLETED = 'depleted',
  EXPIRED = 'expired',
  VOIDED = 'voided',
  SUSPENDED = 'suspended',
}

@Entity({ name: 'gift_cards' })
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'brand_id', type: 'uuid' })
  brandId!: string;

  @ManyToOne(() => GiftCardBrand, (brand) => brand.giftCards)
  @JoinColumn({ name: 'brand_id' })
  brand!: GiftCardBrand;

  @Index({ unique: true })
  @Column({ name: 'card_number', type: 'varchar', length: 32, unique: true })
  cardNumber!: string;

  @Index({ unique: true })
  @Column({ name: 'card_code', type: 'uuid', unique: true })
  cardCode!: string;

  @Column({ name: 'pin_hash', type: 'varchar', length: 255 })
  pinHash!: string;

  @Column({ name: 'initial_balance', type: 'decimal', precision: 10, scale: 2 })
  initialBalance!: number;

  @Column({ name: 'current_balance', type: 'decimal', precision: 10, scale: 2 })
  currentBalance!: number;

  @Column({
    type: 'enum',
    enum: GiftCardStatus,
    default: GiftCardStatus.ACTIVE,
  })
  status!: GiftCardStatus;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt!: Date;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'purchase_order_id', type: 'varchar', length: 255, nullable: true })
  purchaseOrderId?: string | null;

  // Note: kiosk_id removed - get kiosk info from linked order via purchase_order_id
  // This avoids UUID/VARCHAR type mismatch with kiosk_configs table

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Only stores: { pin: "1234" } for admin access

  @OneToMany(() => GiftCardTransaction, (tx) => tx.giftCard)
  transactions?: GiftCardTransaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
