import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Template } from '../templates/template.entity';
import { TemplateBundle } from '../template-bundles/template-bundle.entity';
import { LicenseType } from '../licensing/license-type.entity';

export enum PurchaseType {
  TEMPLATE = 'template',
  BUNDLE = 'bundle'
}

@Entity('sw_template_purchases')
@Index(['userId'])
@Index(['templateId'])
@Index(['bundleId'])
@Index(['purchaseDate'])
@Index(['isActive'])
@Check('(template_id IS NOT NULL AND bundle_id IS NULL) OR (template_id IS NULL AND bundle_id IS NOT NULL)')
export class TemplatePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId?: string;

  @Column({ name: 'license_type_id', type: 'uuid', nullable: true })
  licenseTypeId?: string;

  @Column({ 
    name: 'purchase_type', 
    type: 'varchar', 
    length: 20, 
    default: PurchaseType.TEMPLATE 
  })
  purchaseType: PurchaseType;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;

  @Column({ name: 'original_price', type: 'decimal', precision: 10, scale: 2 })
  originalPrice: number;

  @Column({ name: 'discount_applied', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountApplied: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ name: 'payment_reference', type: 'varchar', length: 255, nullable: true })
  paymentReference?: string;

  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount: number;

  @Column({ name: 'max_usage_count', type: 'integer', nullable: true })
  maxUsageCount?: number;

  @CreateDateColumn({ name: 'purchase_date' })
  purchaseDate: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ name: 'refund_date', type: 'timestamptz', nullable: true })
  refundDate?: Date;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason?: string;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Template, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template?: Template;

  @ManyToOne(() => TemplateBundle, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bundle_id' })
  bundle?: TemplateBundle;

  @ManyToOne(() => LicenseType, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'license_type_id' })
  licenseType?: LicenseType;
}
