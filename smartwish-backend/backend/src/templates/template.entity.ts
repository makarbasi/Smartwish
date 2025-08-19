import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { User } from '../user/user.entity';

@Entity('sw_templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  @Index()
  categoryId?: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  @Index()
  authorId?: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  @Index()
  createdByUserId?: string;

  @Column({ name: 'cover_image', type: 'varchar', length: 500, nullable: true })
  coverImage?: string;

  @Column({ name: 'image_1', type: 'text', nullable: true })
  image1?: string;

  @Column({ name: 'image_2', type: 'text', nullable: true })
  image2?: string;

  @Column({ name: 'image_3', type: 'text', nullable: true })
  image3?: string;

  @Column({ name: 'image_4', type: 'text', nullable: true })
  image4?: string;

  @Column({ type: 'jsonb', nullable: true })
  designData?: any;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  @Column({ type: 'varchar', length: 10, default: 'US' })
  region: string;

  @Column({ name: 'num_downloads', type: 'integer', default: 0 })
  numDownloads: number;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'varchar', default: 'published' })
  status: string;

  @Column({ type: 'integer', default: 0 })
  popularity: number;

  @Column({ name: 'is_user_generated', type: 'boolean', default: false })
  isUserGenerated: boolean;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ name: 'current_version', type: 'varchar', length: 20, default: '1.0.0' })
  currentVersion: string;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User;
}
