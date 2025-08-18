import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TemplateLicense } from './template-license.entity';

@Entity('sw_license_types')
@Index(['isActive'])
@Index(['sortOrder'])
export class LicenseType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'allows_commercial_use', type: 'boolean', default: false })
  allowsCommercialUse: boolean;

  @Column({ name: 'allows_redistribution', type: 'boolean', default: false })
  allowsRedistribution: boolean;

  @Column({ name: 'allows_resale', type: 'boolean', default: false })
  allowsResale: boolean;

  @Column({ name: 'max_usage_count', type: 'integer', nullable: true })
  maxUsageCount?: number;

  @Column({ name: 'usage_period_days', type: 'integer', nullable: true })
  usagePeriodDays?: number;

  @Column({ name: 'price_multiplier', type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  priceMultiplier: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => TemplateLicense, license => license.licenseType)
  templateLicenses: TemplateLicense[];
}
