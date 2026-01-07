import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('stickers')
export class Sticker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  @Index()
  slug?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  category?: string;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'thumbnail_url', type: 'text', nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ type: 'integer', default: 0 })
  @Index()
  popularity: number;

  @Column({ name: 'num_downloads', type: 'integer', default: 0 })
  numDownloads: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
