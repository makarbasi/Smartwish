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

@Entity('saved_designs')
export class SavedDesignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'jsonb' })
  designData: {
    templateKey: string;
    pages: Array<{
      header: string;
      image: string;
      text: string;
      footer: string;
    }>;
    editedPages: Record<number, string>;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnail?: string;

  @Column({ type: 'varchar', length: 100, default: 'User' })
  author: string;

  @Column({
    name: 'upload_time',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  uploadTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  @Column({ type: 'varchar', length: 10, default: 'US' })
  region: string;

  @Column({ type: 'integer', default: 0 })
  popularity: number;

  @Column({ name: 'num_downloads', type: 'integer', default: 0 })
  numDownloads: number;

  @Column({ type: 'text', array: true, default: [] })
  searchKeywords: string[];

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived', 'template_candidate', 'published_to_templates'],
    default: 'draft',
  })
  status: 'draft' | 'published' | 'archived' | 'template_candidate' | 'published_to_templates';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // New fields for sw_templates compatibility
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  @Index()
  templateId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  slug?: string;

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

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_user_generated', type: 'boolean', default: true })
  isUserGenerated: boolean;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ name: 'current_version', type: 'varchar', length: 20, default: '1.0.0' })
  currentVersion: string;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @Column({ name: 'source_template_id', type: 'uuid', nullable: true })
  @Index()
  sourceTemplateId?: string;

  // Virtual property for compatibility with existing code
  get upload_time(): string {
    return this.uploadTime.toISOString();
  }

  get num_downloads(): number {
    return this.numDownloads;
  }
}
