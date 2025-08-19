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
import { TemplateBundle } from './template-bundle.entity';
import { Template } from '../templates/template.entity';

@Entity('sw_template_bundle_items')
@Unique(['bundleId', 'templateId'])
@Index(['bundleId'])
@Index(['templateId'])
export class TemplateBundleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bundle_id', type: 'uuid' })
  bundleId: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  // Relations
  @ManyToOne(() => TemplateBundle, bundle => bundle.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bundle_id' })
  bundle: TemplateBundle;

  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;
}
