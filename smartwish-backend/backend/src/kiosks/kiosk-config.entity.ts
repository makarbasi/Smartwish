import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity({ name: 'kiosk_configs' })
export class KioskConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'kiosk_id', type: 'varchar', length: 128, unique: true })
  kioskId!: string;

  @Column({ name: 'store_id', type: 'varchar', length: 128, nullable: true })
  storeId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string | null;

  @Column({ name: 'api_key', type: 'varchar', length: 255 })
  apiKey!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config!: Record<string, any>;

  @Column({ type: 'varchar', length: 32, default: '1.0.0' })
  version!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  // Sales representative assignment
  @Index()
  @Column({ name: 'sales_representative_id', type: 'uuid', nullable: true })
  salesRepresentativeId?: string | null;

  // Manager commission percent
  @Column({ name: 'manager_commission_percent', type: 'decimal', precision: 5, scale: 2, default: 20.00 })
  managerCommissionPercent!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
