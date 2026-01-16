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
import { TemplateCollection } from './template-collection.entity';
import { Template } from '../templates/template.entity';

@Entity('sw_template_collection_items')
@Unique(['collectionId', 'templateId'])
@Index(['collectionId'])
@Index(['templateId'])
export class TemplateCollectionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  // Relations
  @ManyToOne(() => TemplateCollection, collection => collection.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection: TemplateCollection;

  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;
}
