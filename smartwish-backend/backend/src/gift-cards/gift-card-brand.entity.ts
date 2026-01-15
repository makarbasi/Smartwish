import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GiftCard } from './gift-card.entity';

@Entity({ name: 'gift_card_brands' })
export class GiftCardBrand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'logo_url', type: 'text' })
  logoUrl!: string;

  @Column({ name: 'min_amount', type: 'decimal', precision: 10, scale: 2, default: 10 })
  minAmount!: number;

  @Column({ name: 'max_amount', type: 'decimal', precision: 10, scale: 2, default: 500 })
  maxAmount!: number;

  @Column({ name: 'expiry_months', type: 'integer', default: 12 })
  expiryMonths!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_promoted', type: 'boolean', default: false })
  isPromoted!: boolean;

  @Column({ name: 'is_smartwish_brand', type: 'boolean', default: true })
  isSmartWishBrand!: boolean;

  @OneToMany(() => GiftCard, (card) => card.brand)
  giftCards?: GiftCard[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
