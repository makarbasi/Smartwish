import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Template } from '../templates/template.entity';
import { TemplateCollectionItem } from './template-collection-item.entity';

@Entity('sw_template_collections')
@Index(['userId'])
@Index(['isPublic'])
export class TemplateCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'cover_template_id', type: 'uuid', nullable: true })
  coverTemplateId?: string;

  @Column({ name: 'template_count', type: 'integer', default: 0 })
  templateCount: number;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Template, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cover_template_id' })
  coverTemplate?: Template;

  @OneToMany(() => TemplateCollectionItem, item => item.collection, { cascade: true })
  items: TemplateCollectionItem[];
}
