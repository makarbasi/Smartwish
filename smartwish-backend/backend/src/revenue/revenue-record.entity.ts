import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { Template } from '../templates/template.entity';
import { TemplateBundle } from '../template-bundles/template-bundle.entity';
import { User } from '../user/user.entity';

export enum PayoutStatus {
  PENDING = 'pending',
  PAID = 'paid',
  ON_HOLD = 'on_hold'
}

@Entity('sw_revenue_records')
@Index(['authorUserId'])
@Index(['transactionDate'])
@Index(['payoutStatus'])
export class RevenueRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId?: string;

  @Column({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId?: string;

  @Column({ name: 'buyer_user_id', type: 'uuid', nullable: true })
  buyerUserId?: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;

  @Column({ name: 'platform_fee_percentage', type: 'decimal', precision: 5, scale: 2 })
  platformFeePercentage: number;

  @Column({ name: 'platform_fee_amount', type: 'decimal', precision: 10, scale: 2 })
  platformFeeAmount: number;

  @Column({ name: 'author_earnings', type: 'decimal', precision: 10, scale: 2 })
  authorEarnings: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @CreateDateColumn({ name: 'transaction_date' })
  transactionDate: Date;

  @Column({ 
    name: 'payout_status', 
    type: 'varchar', 
    length: 20, 
    default: PayoutStatus.PENDING 
  })
  payoutStatus: PayoutStatus;

  @Column({ name: 'payout_date', type: 'timestamptz', nullable: true })
  payoutDate?: Date;

  @Column({ name: 'payout_reference', type: 'varchar', length: 255, nullable: true })
  payoutReference?: string;

  // Relations
  @ManyToOne(() => TemplatePurchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: TemplatePurchase;

  @ManyToOne(() => Template, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template?: Template;

  @ManyToOne(() => TemplateBundle, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bundle_id' })
  bundle?: TemplateBundle;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_user_id' })
  author?: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'buyer_user_id' })
  buyer?: User;
}
