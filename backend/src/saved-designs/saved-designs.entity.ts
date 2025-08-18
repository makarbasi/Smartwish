import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
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
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  status: 'draft' | 'published' | 'archived';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual property for compatibility with existing code
  get upload_time(): string {
    return this.uploadTime.toISOString();
  }

  get num_downloads(): number {
    return this.numDownloads;
  }
}
