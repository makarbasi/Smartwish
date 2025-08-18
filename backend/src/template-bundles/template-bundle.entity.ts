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
import { Category } from '../templates/category.entity';
import { Culture } from '../cultures/culture.entity';
import { Region } from '../regions/region.entity';
import { TemplateBundleItem } from './template-bundle-item.entity';

@Entity('sw_template_bundles')
@Index(['isActive'])
@Index(['isFeatured'])
@Index(['categoryId'])
@Index(['cultureId'])
export class TemplateBundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'bundle_price', type: 'decimal', precision: 10, scale: 2 })
  bundlePrice: number;

  @Column({ name: 'individual_price', type: 'decimal', precision: 10, scale: 2 })
  individualPrice: number;

  @Column({ name: 'discount_percentage', type: 'integer', default: 0 })
  discountPercentage: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string;

  @Column({ name: 'culture_id', type: 'uuid', nullable: true })
  cultureId?: string;

  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId?: string;

  @Column({ name: 'cover_image', type: 'varchar', length: 500, nullable: true })
  coverImage?: string;

  @Column({ name: 'download_count', type: 'integer', default: 0 })
  downloadCount: number;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User;

  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @ManyToOne(() => Culture, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'culture_id' })
  culture?: Culture;

  @ManyToOne(() => Region, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'region_id' })
  region?: Region;

  @OneToMany(() => TemplateBundleItem, item => item.bundle, { cascade: true })
  items: TemplateBundleItem[];
}
