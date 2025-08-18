import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Template } from '../templates/template.entity';
import { LicenseType } from './license-type.entity';

@Entity('sw_template_licenses')
@Unique(['templateId', 'licenseTypeId'])
@Index(['templateId'])
@Index(['licenseTypeId'])
export class TemplateLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'license_type_id', type: 'uuid' })
  licenseTypeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @ManyToOne(() => LicenseType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'license_type_id' })
  licenseType: LicenseType;
}
